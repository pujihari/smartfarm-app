import { Routes } from '@angular/router';
import { LayoutComponent } from './components/layout/layout.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { FarmsComponent } from './pages/farms/farms.component';
import { FarmDetailComponent } from './pages/farm-detail/farm-detail.component';
import { FlocksComponent } from './pages/flocks/flocks.component';
import { HealthComponent } from './pages/health/health.component';
import { ProductionComponent } from './pages/production/production.component';
import { InventoryComponent } from './pages/inventory/inventory.component';
import { ReportsComponent } from './pages/reports/reports.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { MembersComponent } from './pages/members/members.component';
import { authGuard } from './auth.guard';
import { publicGuard } from './public.guard';
import { BodyWeightComponent } from './pages/body-weight/body-weight.component';
import { WeeklyPerformanceComponent } from './pages/weekly-performance/weekly-performance.component';
import { roleGuard } from './role.guard'; // Import roleGuard

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [publicGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [publicGuard] },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard], // Pastikan pengguna terautentikasi terlebih dahulu
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'farms', component: FarmsComponent },
      { path: 'farms/:id', component: FarmDetailComponent },
      { path: 'flocks', component: FlocksComponent },
      { path: 'health', component: HealthComponent },
      { path: 'production', component: ProductionComponent },
      { path: 'body-weight', component: BodyWeightComponent },
      { path: 'weekly-performance', component: WeeklyPerformanceComponent },
      { path: 'inventory', component: InventoryComponent },
      { path: 'reports', component: ReportsComponent },
      // Rute yang dilindungi oleh roleGuard
      { 
        path: 'members', 
        component: MembersComponent, 
        canActivate: [roleGuard], 
        data: { roles: ['owner', 'manager'] } // Hanya owner dan manager yang bisa mengakses
      },
      { 
        path: 'settings', 
        component: SettingsComponent, 
        canActivate: [roleGuard], 
        data: { roles: ['owner'] } // Hanya owner yang bisa mengakses
      },
    ]
  },
  { path: '**', redirectTo: '' }
];