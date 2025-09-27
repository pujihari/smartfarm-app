import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { UpdatePasswordComponent } from './pages/update-password/update-password.component';
import { authGuard } from './auth.guard';
import { publicGuard } from './public.guard';
import { roleGuard } from './role.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard] },
  { path: 'update-password', component: UpdatePasswordComponent, canActivate: [authGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { 
        path: 'dashboard', 
        loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) 
      },
      // Rute 'recording' dihapus karena komponennya tidak lagi digunakan
      { 
        path: 'farms', 
        loadComponent: () => import('./pages/farms/farms.component').then(m => m.FarmsComponent) 
      },
      { 
        path: 'farms/:id', 
        loadComponent: () => import('./pages/farm-detail/farm-detail.component').then(m => m.FarmDetailComponent) 
      },
      { 
        path: 'flocks',
        loadComponent: () => import('./pages/flocks-page/flocks-page.component').then(m => m.FlocksPageComponent) 
      },
      { 
        path: 'flocks/:id',
        loadComponent: () => import('./pages/flock-detail/flock-detail.component').then(m => m.FlockDetailComponent) 
      },
      { 
        path: 'health', 
        loadComponent: () => import('./pages/health/health.component').then(m => m.HealthComponent) 
      },
      { 
        path: 'production', 
        loadComponent: () => import('./pages/production/production.component').then(m => m.ProductionComponent) 
      },
      { 
        path: 'body-weight', 
        loadComponent: () => import('./pages/body-weight/body-weight.component').then(m => m.BodyWeightComponent) 
      },
      { 
        path: 'growth-chart', 
        loadComponent: () => import('./pages/growth-chart/growth-chart.component').then(m => m.GrowthChartComponent) 
      },
      { 
        path: 'weekly-performance', 
        loadComponent: () => import('./pages/weekly-performance/weekly-performance.component').then(m => m.WeeklyPerformanceComponent) 
      },
      { 
        path: 'inventory', 
        loadComponent: () => import('./pages/inventory/inventory.component').then(m => m.InventoryComponent) 
      },
      { 
        path: 'reports', 
        loadComponent: () => import('./pages/reports/reports.component').then(m => m.ReportsComponent) 
      },
      { 
        path: 'members', 
        loadComponent: () => import('./pages/members/members.component').then(m => m.MembersComponent),
        canActivate: [roleGuard], 
        data: { roles: ['owner', 'manager'] } 
      },
      { 
        path: 'settings', 
        loadComponent: () => import('./pages/settings/settings.component').then(m => m.SettingsComponent),
        canActivate: [roleGuard], 
        data: { roles: ['owner'] } 
      },
    ]
  },
  { path: '**', redirectTo: '' }
];