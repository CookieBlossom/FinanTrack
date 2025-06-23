import { Directive, Input, TemplateRef, ViewContainerRef, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { FeatureControlService } from '../../services/feature-control.service';

@Directive({
  selector: '[appFeatureControl]',
  standalone: true
})
export class FeatureControlDirective implements OnInit, OnDestroy {
  @Input() appFeatureControl!: string;
  @Input() appFeatureControlPlan?: string; // Para verificar plan específico o superior
  
  private subscription?: Subscription;
  private hasView = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private featureControlService: FeatureControlService
  ) {}

  ngOnInit() {
    if (this.appFeatureControlPlan) {
      // Verificar si tiene un plan específico o superior
      this.subscription = this.featureControlService.hasPlanOrHigher(this.appFeatureControlPlan).subscribe(
        hasPlan => this.updateView(hasPlan)
      );
    } else {
      // Verificar funcionalidad específica
      this.subscription = this.featureControlService.canUseFeature(this.appFeatureControl as any).subscribe(
        canUse => this.updateView(canUse)
      );
    }
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  private updateView(show: boolean) {
    if (show && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!show && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
} 