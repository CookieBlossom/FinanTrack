import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResetPaswordComponent } from './reset-pasword.component';

describe('ResetPaswordComponent', () => {
  let component: ResetPaswordComponent;
  let fixture: ComponentFixture<ResetPaswordComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResetPaswordComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ResetPaswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
