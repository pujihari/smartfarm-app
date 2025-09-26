import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';
import { ReportService, ReportData, ProductionStandard } from '../../services/report.service';
import { FarmService } from '../../services/farm.service';
import { Farm } from '../../models/farm.model';
import { Observable } from 'rxjs';
import * as XLSX from 'xlsx'; // Import xlsx library
import { NotificationService } from '../../services/notification.service'; // Import NotificationService

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, BaseChartDirective],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.css',
  providers: [DatePipe]
})
export class ReportsComponent implements OnInit {
  reportForm: FormGroup;
  farms$: Observable<Farm[]>;
  standards$: Observable<ProductionStandard[]>;
  reportData: ReportData | null = null;
  isLoading = false;

  public lineChartData: ChartConfiguration<'line'>['data'] = {
    labels: [],
    datasets: []
  };
  public lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Hen-Day %'
        }
      }
    }
  };
  public lineChartLegend = true;

  constructor(
    private fb: FormBuilder,
    private reportService: ReportService,
    private farmService: FarmService,
    private datePipe: DatePipe,
    private notificationService: NotificationService // Inject NotificationService
  ) {
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(today.getMonth() - 1);

    this.reportForm = this.fb.group({
      farmId: [''],
      standardId: [''],
      startDate: [this.datePipe.transform(oneMonthAgo, 'yyyy-MM-dd')],
      endDate: [this.datePipe.transform(today, 'yyyy-MM-dd')]
    });

    this.farms$ = this.farmService.getFarms();
    this.standards$ = this.reportService.getProductionStandards();
  }

  ngOnInit(): void {}

  generateReport(): void {
    if (this.reportForm.invalid) {
      this.notificationService.showWarning('Harap lengkapi semua filter tanggal.');
      return;
    }
    this.isLoading = true;
    this.reportData = null;

    const formValue = this.reportForm.value;
    const filters = {
      ...formValue,
      farmId: formValue.farmId ? Number(formValue.farmId) : undefined,
      standardId: formValue.standardId ? Number(formValue.standardId) : undefined
    };

    this.reportService.getReportData(filters).subscribe({
      next: data => {
        this.reportData = data;
        this.lineChartData = {
          labels: data.chartData.labels,
          datasets: data.chartData.datasets
        };
        this.isLoading = false;
        this.notificationService.showSuccess('Laporan berhasil dibuat!');
      },
      error: err => {
        this.notificationService.showError(`Gagal membuat laporan: ${err.message}`);
        this.isLoading = false;
      }
    });
  }

  downloadReportAsExcel(): void {
    if (!this.reportData) {
      this.notificationService.showWarning('Tidak ada data laporan untuk diunduh.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan KPI
    const kpiData = [
      ['Metrik', 'Nilai', 'Satuan'],
      ['Total Produksi (Butir)', this.reportData.kpis.totalEggCount, 'butir'],
      ['Total Produksi (Kg)', this.reportData.kpis.totalEggWeightKg.toFixed(2), 'kg'],
      ['Total Pakan (Kg)', this.reportData.kpis.totalFeedConsumption.toFixed(2), 'kg'],
      ['FCR (Pakan/Produksi)', this.reportData.kpis.fcr.toFixed(2), '-']
    ];
    const ws1 = XLSX.utils.aoa_to_sheet(kpiData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Ringkasan KPI');

    // Sheet 2: Data Tren Harian (HD%)
    const chartLabels = this.reportData.chartData.labels;
    const datasets = this.reportData.chartData.datasets;

    const hdTrendHeaders = ['Tanggal', 'HD% Aktual'];
    const standardMinDataset = datasets.find(ds => ds.label === 'HD% Standar (Min)');
    const standardMaxDataset = datasets.find(ds => ds.label === 'HD% Standar (Max)');

    if (standardMinDataset) hdTrendHeaders.push('HD% Standar (Min)');
    if (standardMaxDataset) hdTrendHeaders.push('HD% Standar (Max)');

    const hdTrendData: (string | number | null)[][] = [hdTrendHeaders]; // Fixed: Explicitly type hdTrendData
    for (let i = 0; i < chartLabels.length; i++) {
      const row: (string | number | null)[] = [chartLabels[i]];
      const actualValue = datasets.find(ds => ds.label === 'HD% Aktual')?.data[i];
      row.push(actualValue !== undefined && actualValue !== null ? parseFloat(actualValue.toFixed(2)) : null);

      if (standardMinDataset) {
        const minValue = standardMinDataset.data[i];
        row.push(minValue !== undefined && minValue !== null ? parseFloat(minValue.toFixed(2)) : null);
      }
      if (standardMaxDataset) {
        const maxValue = standardMaxDataset.data[i];
        row.push(maxValue !== undefined && maxValue !== null ? parseFloat(maxValue.toFixed(2)) : null);
      }
      hdTrendData.push(row);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(hdTrendData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Tren HD%');

    // Add filter info to a separate sheet or at the top of the first sheet
    const filterInfo = [
      ['Filter Laporan'],
      ['Farm:', this.reportForm.get('farmId')?.value ? (this.farms$ as any).value.find((f: Farm) => f.id === Number(this.reportForm.get('farmId')?.value))?.name || 'N/A' : 'Semua Farm'],
      ['Standar:', this.reportForm.get('standardId')?.value ? (this.standards$ as any).value.find((s: ProductionStandard) => s.id === Number(this.reportForm.get('standardId')?.value))?.name || 'N/A' : 'Tidak ada'],
      ['Tanggal Mulai:', this.datePipe.transform(this.reportForm.get('startDate')?.value, 'dd MMMM yyyy')],
      ['Tanggal Selesai:', this.datePipe.transform(this.reportForm.get('endDate')?.value, 'dd MMMM yyyy')]
    ];
    const wsFilters = XLSX.utils.aoa_to_sheet(filterInfo);
    XLSX.utils.book_append_sheet(wb, wsFilters, 'Filter');


    const fileName = `Laporan_Performa_Flok_${this.datePipe.transform(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    this.notificationService.showSuccess('Laporan Excel berhasil diunduh!');
  }
}