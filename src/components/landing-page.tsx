"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Users, 
  Building2, 
  Shield, 
  Zap, 
  ArrowRight,
  CheckCircle2,
  FolderTree,
  Bell
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Group Management",
    description: "View and manage all your Roblox groups in one place. Change roles, kick members, and more.",
  },
  {
    icon: Zap,
    title: "Point Automation",
    description: "Set up automatic role promotions based on points. Reward active members effortlessly.",
  },
  {
    icon: FolderTree,
    title: "Sub-Groups",
    description: "Create divisions within your group with custom promotion rules for each department.",
  },
  {
    icon: Building2,
    title: "Organizations",
    description: "Link multiple groups together and sync roles automatically across your organization.",
  },
  {
    icon: Shield,
    title: "Suspension System",
    description: "Temporarily suspend members with automatic restoration when the time expires.",
  },
  {
    icon: Bell,
    title: "Audit Logging",
    description: "Track all actions with detailed logs and Discord webhook integration.",
  },
];

const benefits = [
  "Manage multiple groups from one dashboard",
  "Automatic role synchronization",
  "Custom point-based promotion rules",
  "Department-specific automation",
  "Discord webhook notifications",
  "Secure Roblox OAuth authentication",
];

export function LandingPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
        
        <div className="container relative mx-auto px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-8 inline-flex items-center rounded-full border bg-muted/50 px-4 py-1.5 text-sm">
              <span className="mr-2">🚀</span>
              <span>Streamline your Roblox group management</span>
            </div>
            
            <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Manage Your Roblox Groups
              <span className="text-primary"> Effortlessly</span>
            </h1>
            
            <p className="mb-10 text-lg text-muted-foreground sm:text-xl max-w-2xl mx-auto">
              RoGrouper is your all-in-one solution for managing Roblox groups. 
              Automate promotions, sync roles across organizations, and keep track of everything.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                onClick={() => signIn("roblox")}
                className="gap-2 text-lg px-8"
              >
                Get Started
                <ArrowRight className="h-5 w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                className="gap-2 text-lg px-8"
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">Powerful Features</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your Roblox groups efficiently
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="border-0 shadow-lg bg-background/50 backdrop-blur">
                <CardContent className="p-6">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            <div>
              <h2 className="text-3xl font-bold mb-6">
                Why Choose RoGrouper?
              </h2>
              <p className="text-muted-foreground mb-8">
                Built by group owners, for group owners. We understand the challenges 
                of managing large Roblox communities and have created tools to make it easier.
              </p>
              
              <ul className="space-y-4">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="relative">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border shadow-2xl flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="h-16 w-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                    <span className="text-primary-foreground font-bold text-2xl">RG</span>
                  </div>
                  <p className="text-lg font-medium">Your Dashboard Awaits</p>
                  <p className="text-sm text-muted-foreground">Sign in to get started</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-primary/5">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of group owners who trust RoGrouper to manage their communities.
          </p>
          <Button 
            size="lg" 
            onClick={() => signIn("roblox")}
            className="gap-2 text-lg px-8"
          >
            Sign in with Roblox
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} RoGrouper. Not affiliated with Roblox Corporation.</p>
        </div>
      </footer>
    </div>
  );
}
