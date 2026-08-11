import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getMyTurnSettings,
  saveMyTurnSettings,
  testMyTurnSettings,
} from "@/lib/turn-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Wifi, ExternalLink } from "lucide-react";

export function TurnSettingsCard() {
  const qc = useQueryClient();
  const load = useServerFn(getMyTurnSettings);
  const save = useServerFn(saveMyTurnSettings);
  const test = useServerFn(testMyTurnSettings);

  const { data } = useQuery({ queryKey: ["my-turn-settings"], queryFn: () => load() });

  const [keyId, setKeyId] = useState("");
  const [token, setToken] = useState("");
  const [urls, setUrls] = useState("");
  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");

  useEffect(() => {
    if (data) {
      setKeyId(data.turnKeyId ?? "");
      setUrls(data.turnUrls ?? "");
      setUsername(data.turnUsername ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: () =>
      save({
        data: {
          turnKeyId: keyId,
          turnApiToken: token,
          turnUrls: urls,
          turnUsername: username,
          turnCredential: credential,
        },
      }),
    onSuccess: () => {
      toast.success("Configuración TURN guardada");
      setToken("");
      setCredential("");
      qc.invalidateQueries({ queryKey: ["my-turn-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const check = useMutation({
    mutationFn: () => test(),
    onSuccess: (res) => {
      if (res.hasTurn) {
        toast.success(
          res.provider === "cloudflare"
            ? "Cloudflare TURN activo"
            : "TURN personalizado activo",
        );
      } else {
        toast.error("Sin TURN: solo STUN (misma red)");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" /> Conexión en tiempo real (TURN)
          {data?.hasTurnApiToken ? (
            <Badge variant="secondary">Cloudflare configurado</Badge>
          ) : null}
        </CardTitle>
        <CardDescription>
          Necesario para que el mosaico multicámara conecte entre redes distintas
          (móvil 4G ↔ PC). Cloudflare Realtime TURN tiene un plan gratuito con 1.000 GB
          de tráfico al mes: crea una clave TURN en tu panel de Cloudflare y pega aquí el
          identificador y el token.
          <span className="mt-2 flex flex-wrap gap-3">
            <a
              href="https://dash.cloudflare.com/?to=/:account/realtime/turn"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            >
              Crear clave TURN en Cloudflare <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href="https://developers.cloudflare.com/realtime/turn/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2"
            >
              Documentación <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </span>
        </CardDescription>

      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="turn-key-id">Cloudflare TURN Key ID</Label>
          <Input
            id="turn-key-id"
            value={keyId}
            onChange={(e) => setKeyId(e.target.value)}
            placeholder="p. ej. 7a1b…"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="turn-token">Cloudflare TURN API Token</Label>
          <Input
            id="turn-token"
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={data?.turnApiTokenMasked ?? "Pega el token"}
          />
          <p className="text-xs text-muted-foreground">
            Se guarda cifrado y solo se muestra enmascarado. Déjalo en blanco para no
            modificarlo.
          </p>
        </div>

        <div className="border-t pt-4 space-y-4">
          <p className="text-sm font-medium">
            Alternativa: servidor TURN propio (opcional)
          </p>
          <div className="space-y-2">
            <Label htmlFor="turn-urls">URLs TURN (separadas por comas)</Label>
            <Input
              id="turn-urls"
              value={urls}
              onChange={(e) => setUrls(e.target.value)}
              placeholder="turn:mi-servidor.com:3478?transport=udp"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="turn-user">Usuario</Label>
              <Input
                id="turn-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="turn-cred">Contraseña</Label>
              <Input
                id="turn-cred"
                type="password"
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                placeholder={data?.hasTurnCredential ? "••••" : ""}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? "Guardando…" : "Guardar TURN"}
          </Button>
          <Button
            variant="outline"
            onClick={() => check.mutate()}
            disabled={check.isPending}
          >
            {check.isPending ? "Probando…" : "Probar conexión"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
