import { airDeps, airLimiter } from "@/server/air/runtime";
import { airGet } from "@/server/handlers/air";

/** `GET /api/air`: thin shell over the tested handler. */
export function GET(request: Request) {
  return airGet(request, airDeps(), airLimiter);
}
