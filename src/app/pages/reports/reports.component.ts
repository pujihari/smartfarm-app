import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';
import { ReportService, ReportData, ProductionStandard } from '../../services/report.service';
import { FarmService } from '../../services/farm.service';
import { Farm } from '../../models/farm.model';
import { Observable } from 'rxjs';

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
    private datePipe: DatePipe
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

    this.reportService.getReportData(filters).subscribe(data => {
      this.reportData = data;
      this.lineChartData = {
        labels: data.chartData.labels,
        datasets: data.chartData.datasets
      };
      this.isLoading = false;
    });
  }
}