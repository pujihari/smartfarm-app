import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgClass } from '@angular/common';
import { DashboardService, DashboardKpis, ChartData } from '../../services/dashboard.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { ChartOptions, ChartConfiguration } from 'chart.js';
import { OrganizationService } from '../../services/organization.service';
import { Organization } from '../../models/organization.model';

interface KpiCard {
  title: string;
  value: string;
  note?: string;
  loading: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, NgClass, BaseChartDirective],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  kpiCards$: Observable<KpiCard[]>;
  isChartLoading = true;

  connectionStatus: string = 'Menguji koneksi database...';
  connectionError: string | null = null;
  connectionWarning: string | null = null;

  public barChartData: ChartConfiguration<'bar'>['data'] = {
    labels: [],
    datasets: []
  };
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: function(value) {
            if (typeof value === 'number') {
              return value.toLocaleString('id-ID');
            }
            return value;
          }
        }
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            let label = context.dataset.label || '';
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              label += context.parsed.y.toLocaleString('id-ID') + ' butir';
            }
            return label;
          }
        }
      }
    }
  };
  public barChartType = 'bar' as const;

  constructor(
    private dashboardService: DashboardService,
    private organizationService: OrganizationService
  ) {
    this.kpiCards$ = of(this.getLoadingKpiCards());
  }

  ngOnInit(): void {
    this.organizationService.getOrganization().subscribe({
      next: (org: Organization | null) => {
        if (org) {
          this.connectionStatus = `Koneksi berhasil. Data dimuat untuk organisasi: ${org.name}.`;
          this.connectionError = null;
          this.connectionWarning = null;
          this.loadDashboardData();
        } else {
          this.connectionStatus = 'Koneksi berhasil, tetapi tidak ada organisasi yang terkait dengan akun pengguna Anda.';
          this.connectionWarning = 'Silakan keluar dan gunakan tautan "Daftar" untuk membuat akun dan organisasi baru. Akun pengguna Anda saat ini mungkin dibuat sebelum pembaruan sistem dan tidak dapat mengakses data.';
          this.connectionError = null;
          this.kpiCards$ = of(this.getNoOrgKpiCards());
          this.isChartLoading = false;
        }
      },
      error: (err) => {
        this.connectionStatus = 'Koneksi database gagal.';
        this.connectionError = err.message;
        this.connectionWarning = null;
        this.kpiCards$ = of(this.getErrorKpiCards());
        this.isChartLoading = false;
      }
    });
  }

  loadDashboardData(): void {
    this.kpiCards$ = this.dashboardService.getDashboardKpis().pipe(
      map((data: DashboardKpis) => [
        {
          title: 'Total Farm',
          value: data.totalFarms.toLocaleString('id-ID'),
          loading: false
        },
        {
          title: 'Total Populasi Ayam',
          value: data.totalPopulation.toLocaleString('id-ID'),
          loading: false
        },
        {
          title: 'Hen-Day Rate Rata-rata',
          value: `${data.henDayRate.toFixed(1)}%`,
          note: 'Berdasarkan data hari terakhir',
          loading: false
        },
        {
          title: 'Mortalitas Rata-rata',
          value: `${data.mortalityRate.toFixed(2)}%`,
          note: 'Data belum tersedia',
          loading: false
        },
      ]),
      catchError(() => of(this.getErrorKpiCards()))
    );

    this.dashboardService.getProductionPerFarmChartData().subscribe((chartData: ChartData) => {
      this.barChartData = {
        labels: chartData.labels,
        datasets: chartData.datasets
      };
      this.isChartLoading = false;
    });
  }

  private getLoadingKpiCards(): KpiCard[] {
    return [
      { title: 'Total Farm', value: '...', loading: true },
      { title: 'Total Populasi Ayam', value: '...', loading: true },
      { title: 'Hen-Day Rate Rata-rata', value: '...', loading: true },
      { title: 'Mortalitas Rata-rata', value: '...', loading: true },
    ];
  }

  private getErrorKpiCards(): KpiCard[] {
    return [
      { title: 'Total Farm', value: 'Error', loading: false },
      { title: 'Total Populasi Ayam', value: 'Error', loading: false },
      { title: 'Hen-Day Rate Rata-rata', value: 'Error', loading: false },
      { title: 'Mortalitas Rata-rata', value: 'Error', loading: false },
    ];
  }

  private getNoOrgKpiCards(): KpiCard[] {
    return [
      { title: 'Total Farm', value: 'N/A', loading: false, note: 'No organization found' },
      { title: 'Total Populasi Ayam', value: 'N/A', loading: false },
      { title: 'Hen-Day Rate Rata-rata', value: 'N/A', loading: false },
      { title: 'Mortalitas Rata-rata', value: 'N/A', loading: false },
    ];
  }
}