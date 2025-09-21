import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { ProductionData, FeedConsumption } from '../../models/production-data.model';
import { Flock } from '../../models/flock.model';
import { InventoryService, FeedOption } from '../../services/inventory.service'; // Import InventoryService dan FeedOption

@Component({
  selector: 'app-production-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './production-modal.component.html',
  styleUrl: './production-modal.component.css'
})
export class ProductionModalComponent implements OnInit {
  @Input() data: ProductionData | null = null;
  @Input() flocks: (Flock & { farmName: string })[] = [];
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<ProductionData>>();

  productionForm: FormGroup;
  feedOptions: FeedOption[] = []; // Properti baru untuk menyimpan opsi pakan

  constructor(private fb: FormBuilder, private inventoryService: InventoryService) { // Inject InventoryService
    this.productionForm = this.fb.group({
      flock_id: [null, Validators.required],
      date: ['', Validators.required],
      normal_eggs: [null, [Validators.required, Validators.min(0)]],
      white_eggs: [null, [Validators.required, Validators.min(0)]],
      cracked_eggs: [null, [Validators.required, Validators.min(0)]],
      normal_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      white_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      cracked_eggs_weight_kg: [null, [Validators.required, Validators.min(0)]],
      feed_consumption: this.fb.array([]),
      notes: [''] // New: notes field
    });
  }

  ngOnInit(): void {
    // Muat opsi pakan saat komponen diinisialisasi
    this.inventoryService.getFeedOptions().subscribe({
      next: (options) => this.feedOptions = options,
      error: (err) => console.error('Error loading feed options:', err)
    });

    if (this.data) {
      const formattedData = {
        ...this.data,
        date: this.data.date.split('T')[0]
      };
      this.productionForm.patchValue(formattedData);
      this.feed_consumption.clear();
      this.data.feed_consumption.forEach(feed => this.addFeed(feed));
    } else {
      this.addFeed(); // Tambahkan satu baris pakan kosong secara default
    }
  }

  get feed_consumption(): FormArray {
    return this.productionForm.get('feed_consumption') as FormArray;
  }

  createFeedGroup(feed?: FeedConsumption): FormGroup {
    return this.fb.group({
      feed_code: [feed?.feed_code || '', Validators.required],
      quantity_kg: [feed?.quantity_kg || null, [Validators.required, Validators.min(0.1)]]
    });
  }

  addFeed(feed?: FeedConsumption): void {
    this.feed_consumption.push(this.createFeedGroup(feed));
  }

  removeFeed(index: number): void {
    this.feed_consumption.removeAt(index);
  }

  onSave(): void {
    if (this.productionForm.valid) {
      this.save.emit({ ...this.data, ...this.productionForm.value });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}