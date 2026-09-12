import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Database, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { checkExternalDatabase } from "@/lib/external-data.functions";

type Result = { configured: boolean; ok: boolean; message: string };

export function ExternalDatabaseCard() {
  const check = useServerFn(checkExternalDatabase);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const res = (await check()) as Result;
      setResult(res);
    } catch {
      setResult({
        configured: true,
        ok: false,
        message: "No se ha podido comprobar la conexión.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Database className="h-4 w-4" /> Base de datos externa
        </CardTitle>
        <CardDescription>
          Comprueba si el servidor propio responde correctamente. Mientras no
          responda, la aplicación sigue usando la base de datos actual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button onClick={run} disabled={loading} variant="outline">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Comprobando…
            </>
          ) : (
            "Comprobar conexión"
          )}
        </Button>

        {result && (
          <div
            className={`flex items-start gap-2 rounded-md border p-3 text-sm ${
              result.ok
                ? "border-primary/30 bg-primary/5"
                : "border-destructive/30 bg-destructive/5"
            }`}
          >
            {result.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
            ) : (
              <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
            )}
            <span>{result.message}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
