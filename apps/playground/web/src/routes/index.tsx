import type React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Code2, Rocket, Wallet, FileCode2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const Route = createFileRoute('/')({
  component: LandingPage,
});

function LandingPage(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">Tempo Playground</span>
          </div>
          <nav className="flex items-center gap-4">
            <a
              href="https://docs.tempo.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Docs
            </a>
            <a
              href="https://gateway.temporium.xyz"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Gateway
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Contract Playground
          </h1>
          <p className="mb-8 text-lg text-muted-foreground">
            Write, compile, and deploy Solidity contracts to Tempo blockchain.
            <br />
            No setup required - everything runs in your browser.
          </p>
          <Button size="lg" className="gap-2" asChild>
            <a href="/editor">
              <Rocket className="h-4 w-4" />
              Start Building
            </a>
          </Button>
        </div>

        {/* Features */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-6 sm:grid-cols-3">
          <FeatureCard
            icon={<FileCode2 className="h-6 w-6" />}
            title="Write & Compile"
            description="Full Solidity support with Monaco editor. Compile in-browser with solc.js."
          />
          <FeatureCard
            icon={<Rocket className="h-6 w-6" />}
            title="Deploy"
            description="Deploy contracts to Tempo testnet with one click using passkey wallets."
          />
          <FeatureCard
            icon={<Wallet className="h-6 w-6" />}
            title="Interact"
            description="Call contract functions, view events, and manage your deployments."
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          Built for Tempo Blockchain
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureCard({ icon, title, description }: FeatureCardProps): React.ReactElement {
  return (
    <Card className="bg-card/50">
      <CardHeader>
        <div className="mb-2 text-primary">{icon}</div>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription>{description}</CardDescription>
      </CardContent>
    </Card>
  );
}
