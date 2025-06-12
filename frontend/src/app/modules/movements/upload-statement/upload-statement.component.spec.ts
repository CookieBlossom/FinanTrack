import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadStatementComponent } from './upload-statement.component';

describe('UploadStatementComponent', () => {
  let component: UploadStatementComponent;
  let fixture: ComponentFixture<UploadStatementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UploadStatementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UploadStatementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
