import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryItem, ItemType } from '../../models/inventory-item.model';

@Component({
  selector: 'app-inventory-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './inventory-modal.component.html',
  styleUrl: './inventory-modal.component.css'
})
export class InventoryModalComponent implements OnInit {
  @Input() item: InventoryItem | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<Partial<InventoryItem>>();

  itemForm: FormGroup;
  itemTypes: ItemType[] = ['PAKAN', 'VITAMIN', 'OBAT', 'VAKSIN'];

  constructor(private fb: FormBuilder) {
    this.itemForm = this.fb.group({
      item_type: [null, Validators.required],
      item_code: [''],
      name: ['', Validators.required],
      quantity: [0, [Validators.required, Validators.min(0)]],
      unit: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    if (this.item) {
      this.itemForm.patchValue(this.item);
    }

    this.itemForm.get('item_type')?.valueChanges.subscribe(type => {
      const itemCodeControl = this.itemForm.get('item_code');
      if (type === 'PAKAN') {
        itemCodeControl?.setValidators([Validators.required]);
      } else {
        itemCodeControl?.clearValidators();
        itemCodeControl?.setValue('');
      }
      itemCodeControl?.updateValueAndValidity();
    });
  }

  onSave(): void {
    if (this.itemForm.valid) {
      this.save.emit({ ...this.item, ...this.itemForm.value });
    }
  }

  onClose(): void {
    this.close.emit();
  }
}