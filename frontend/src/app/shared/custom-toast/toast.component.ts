import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';

@Component({
    selector: 'app-toast',
    templateUrl: './toast.component.html',
    styleUrls: ['./toast.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class ToastComponent {
  @Input() show = false;
  @Input() message = '';
  @Input() type: 'success' | 'error' | 'info' = 'info';
  @Output() closed = new EventEmitter<void>();

  onClose() {
    this.closed.emit();
  }
}