import { redirect } from "next/navigation";

// No existe pagina de login dedicada: el login vive en el modal de /mi-cuenta
// (?login=required). Esta ruta evita el 404 cuando el usuario escribe /login.
export default function LoginRedirect(): never {
  redirect("/mi-cuenta?login=required");
}
