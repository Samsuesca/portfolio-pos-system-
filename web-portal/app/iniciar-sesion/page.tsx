import { redirect } from "next/navigation";

// Alias en español de /login. Ambas abren el modal de login en /mi-cuenta.
export default function IniciarSesionRedirect(): never {
  redirect("/mi-cuenta?login=required");
}
