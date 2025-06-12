import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CondiconesComponent } from './condiciones.component';

describe('CondiconesComponent', () => {
  let component: CondiconesComponent;
  let fixture: ComponentFixture<CondiconesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CondiconesComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CondiconesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
