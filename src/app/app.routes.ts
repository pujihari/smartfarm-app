import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { UpdatePasswordComponent } from './pages/update-password/update-password.component'; // Import baru
import { authGuard } from './auth.guard';
import { publicGuard } from './public.guard';
import { roleGuard } from './role.guard';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard] },
  { path: 'update-password', component: UpdatePasswordComponent, canActivate: [authGuard] }, // Rute baru
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
        loadComponent: () => import('./pages/flocks/flocks.component').then(m => m.FlocksComponent) 
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