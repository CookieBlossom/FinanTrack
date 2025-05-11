

import { Component } from '@angular/core';
import {
    MatDialog,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatDialogRef,
    MatDialogTitle,
  } from '@angular/material/dialog';
  import { MatIconModule } from '@angular/material/icon';
  import { MatIcon } from '@angular/material/icon';




@Component({
  selector: 'dialog',
  standalone: true,
  imports: [MatIconModule,MatIcon, MatDialogActions,MatDialogClose,
    MatDialogContent,
    MatDialogTitle,],
  templateUrl: './dialog.component.html',
  styleUrls: ['./dialog.component.scss']
})
export class DialogComponent{}