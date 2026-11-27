import { Component, Suspense, type ReactNode } from "react";
import { Alert, Button, Skeleton } from "./ui";

// Parti caricate all'apertura. "Riprova" ricarica la pagina: dopo un deploy i vecchi file non ci sono più e ripetere l'import non basta.
export function LoadError() { return <Alert tone="danger">Questa parte non si è caricata: controlla la connessione. <Button variant="outline" onClick={() => window.location.reload()}>Riprova</Button></Alert>; }

// Solo i file non caricati si fermano qui: gli altri errori restano errori dell'app.
const isLoadError = (error: unknown) => error instanceof Error && /dynamically imported module|importing a module script|preload CSS/i.test(error.message);

export class LazyBoundary extends Component<{ children: ReactNode }, { error: unknown }> {
  state = { error: null as unknown };
  static getDerivedStateFromError(error: unknown) { return { error }; }
  render() {
    const { error } = this.state;
    if (error !== null && !isLoadError(error)) throw error;
    if (error !== null) return <LoadError/>;
    return <Suspense fallback={<Skeleton/>}>{this.props.children}</Suspense>;
  }
}
