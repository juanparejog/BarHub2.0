import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-email-verification',
  templateUrl: './email-verification.component.html',
  styleUrls: ['./email-verification.component.css']
})
export class EmailVerificationComponent implements OnInit {

  message: string = '';

  constructor(
    private route: ActivatedRoute,  // Para obtener el token desde la URL
    private authService: AuthService  // Para llamar al servicio de verificación
  ) { }

  ngOnInit(): void {
    // Obtener el token desde los parámetros de la URL
    const token = this.route.snapshot.queryParamMap.get('token');
    
    if (token) {
      // Llamar al servicio para verificar el correo electrónico
      this.authService.verifyEmail(token).subscribe(
        response => {
          this.message = '¡Cuenta verificada con éxito!';
        },
        error => {
          this.message = 'Hubo un error al verificar la cuenta. Intenta de nuevo.';
        }
      );
    } else {
      this.message = 'No se proporcionó un token válido.';
    }
  }
}