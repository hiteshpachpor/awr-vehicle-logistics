export function LoadingScreen({ message }: { message: string }) {
  return (
    <main
      aria-busy="true"
      className="grid min-h-[100dvh] place-items-center bg-background"
    >
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
    </main>
  );
}
