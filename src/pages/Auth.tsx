import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertCircle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import firebaseConfig from "../../firebase-applet-config.json";

const GoogleIcon = () => (
  <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { user, signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/projects");
    }
  }, [user, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Fyll i alla fält", variant: "destructive" });
      return;
    }
    
    setIsLoading(true);
    const { error } = await signIn(email, password);
    setIsLoading(false);

    if (error) {
      console.error("Sign in failed:", error);
      let message = "Inloggning misslyckades";
      let description = error.message || "Ett okänt fel uppstod.";
      
      const errMsg = error.message || "";
      const errCode = (error as any).code || "";
      
      if (errCode === "auth/invalid-credential" || errCode === "auth/user-not-found" || errCode === "auth/wrong-password" || errMsg.includes("invalid-credential")) {
        message = "Fel e-post eller lösenord";
        description = "Kontrollera att du har angett rätt uppgifter eller registrera ett nytt konto.";
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        message = "Metoden är inte aktiverad";
        description = "Inloggning med e-post och lösenord är inte aktiverat i din Firebase Console. Gå till Authentication -> Sign-in method och aktivera 'Email/Password'.";
        setShowHelp(true);
      } else if (errCode === "auth/unauthorized-domain" || errMsg.includes("unauthorized-domain")) {
        message = "Obehörig domän";
        description = `Denna domän (${window.location.hostname}) är inte godkänd i din Firebase Console under Authorized Domains.`;
        setShowHelp(true);
      }
      
      toast({ 
        title: message, 
        description: description, 
        variant: "destructive" 
      });
    } else {
      toast({ title: "Inloggad!" });
      navigate("/projects");
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Fyll i alla fält", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Lösenordet måste vara minst 6 tecken", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { error } = await signUp(email, password, displayName);
    setIsLoading(false);

    if (error) {
      console.error("Sign up failed:", error);
      let message = "Registrering misslyckades";
      let description = error.message || "Ett okänt fel uppstod.";
      
      const errMsg = error.message || "";
      const errCode = (error as any).code || "";
      
      if (errCode === "auth/email-already-in-use" || errMsg.includes("already-in-use") || errMsg.includes("already registered")) {
        message = "E-postadressen används redan";
        description = "Det finns redan ett konto registrerat med denna e-postadress. Prova att logga in istället.";
      } else if (errCode === "auth/operation-not-allowed" || errMsg.includes("operation-not-allowed")) {
        message = "Registrering blockerad";
        description = "E-post och lösenord är inte aktiverat som inloggningsmetod under Authentication -> Sign-in method i din Firebase Console.";
        setShowHelp(true);
      } else if (errCode === "auth/weak-password" || errMsg.includes("weak-password")) {
        message = "För svagt lösenord";
        description = "Välj ett lösenord som är minst 6 tecken långt.";
      }
      
      toast({ 
        title: message, 
        description: description, 
        variant: "destructive" 
      });
    } else {
      toast({ 
        title: "Konto skapat!", 
        description: "Ditt konto har skapats och du är nu registrerad." 
      });
      // The Firebase createUserWithEmailAndPassword SDK auto-signs the user in, so navigate() will trigger via useEffect.
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/projects",
      },
    });
    setIsLoading(false);
    if (error) {
      console.error("Google Auth error:", error);
      let errorDesc = error.message || "Ett okänt fel uppstod.";
      if (error.code === "auth/unauthorized-domain" || error.message?.includes("auth/unauthorized-domain") || error.message?.includes("unauthorized-domain")) {
        errorDesc = `Domänen "${window.location.hostname}" är inte tillagd i din Firebase-konsol under godkända domäner.`;
        setShowHelp(true);
      } else if (error.code === "auth/popup-closed-by-user" || error.message?.includes("popup-closed-by-user") || error.message?.includes("closed by user")) {
        errorDesc = "Inloggningsfönstret stängdes innan inloggningen slutfördes.";
      } else if (error.code === "auth/operation-not-allowed" || error.message?.includes("operation-not-allowed")) {
        errorDesc = "Google-inloggning är inte aktiverat som inloggningsmetod i ditt Firebase-projekt.";
        setShowHelp(true);
      } else if (error.message?.includes("third-party cookies") || error.message?.includes("cookie")) {
        errorDesc = "Din webbläsare blockerar kakor (cookies) från tredje part i förhandsvisningen. Prova att klicka på 'Öppna i ny flik'.";
        setShowHelp(true);
      }
      
      toast({ 
        title: "Google-inloggning misslyckades", 
        description: errorDesc, 
        variant: "destructive" 
      });
    }
  };

  const handleLocalSandboxMode = () => {
    setIsLoading(true);
    localStorage.setItem("dmaic_local_mode", "true");
    
    const user = {
      id: "local-sandbox-user",
      email: "demo@sixsigma.local",
      user_metadata: { display_name: "Demo Användare" }
    };
    const session = {
      access_token: "mock-token-local",
      user
    };
    localStorage.setItem("dmaic_mock_session", JSON.stringify(session));
    
    toast({ 
      title: "Välkommen!", 
      description: "Du kör nu i lokalt demoläge. Dina projekt sparas direkt i din webbläsare." 
    });
    
    setTimeout(() => {
      // Force reload to completely refresh the hook state
      window.location.reload();
    }, 500);
  };

  return (
    <Layout>
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto">
            <Card>
              <CardHeader className="text-center">
                <CardTitle className="text-2xl">DMAIC Projekthantering</CardTitle>
                <CardDescription>
                  Logga in för att spara dina projekt och analyser
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="signin">
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="signin">Logga in</TabsTrigger>
                    <TabsTrigger value="signup">Registrera</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signin-email">E-post</Label>
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="din@email.se"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signin-password">Lösenord</Label>
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Logga in
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-name">Namn (valfritt)</Label>
                        <Input
                          id="signup-name"
                          type="text"
                          placeholder="Ditt namn"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">E-post</Label>
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="din@email.se"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password">Lösenord</Label>
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Minst 6 tecken"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        Skapa konto
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">eller</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full mb-3"
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                >
                  <GoogleIcon />
                  Fortsätt med Google
                </Button>

                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-all hover:shadow-md"
                  onClick={handleLocalSandboxMode}
                  disabled={isLoading}
                >
                  Starta i lokalt demoläge (Ingen inloggning krävs)
                </Button>

                <div className="mt-6 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setShowHelp(!showHelp)}
                    className="flex items-center justify-between w-full text-left text-xs font-semibold text-muted-foreground hover:text-foreground transition-all py-1 animate-pulse"
                  >
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Problem med Google-inloggningen? Klicka för lösning!
                    </span>
                    {showHelp ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>

                  {showHelp && (
                    <div className="mt-3 space-y-3.5 text-xs text-muted-foreground bg-muted/60 p-4 rounded-lg border border-border/80">
                      <p className="leading-relaxed">
                        Eftersom appen körs i AI Studio-miljön (i en iframe) kan vissa webbläsare blockera popup-fönster eller cookies som Google kräver för inloggningen.
                      </p>

                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</div>
                          <div>
                            <strong className="text-foreground block mb-0.5">Öppna i en ny flik (Rekommenderas)</strong>
                            Klicka på knappen <span className="font-semibold text-foreground">"Öppna i ny flik"</span> längst upp till höger i förhandsvisningen för att öppna appen direkt och logga in stabilt utan iframe-begränsningar.
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</div>
                          <div>
                            <strong className="text-foreground block mb-0.5">Aktivera Google i Firebase Console</strong>
                            Öppna din <a href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/providers`} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">Firebase Console &rarr;</a> under <span className="font-semibold text-foreground">Authentication &rarr; Sign-in method</span> och kontrollera att <span className="font-semibold text-foreground">Google</span>-inloggningen är aktiverad.
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</div>
                          <div>
                            <strong className="text-foreground block mb-0.5">Lägg till din domän i Firebase</strong>
                            Firebase blockerar inloggningsförsök från okända domäner. Gå till din Firebase Console &rarr; Authentication &rarr; Settings &rarr; Authorized domains och lägg till följande domän:
                            <code className="block bg-background/80 p-2 rounded border font-mono select-all text-amber-600 font-semibold mt-2 break-all">{window.location.hostname}</code>
                          </div>
                        </div>

                        <div className="flex gap-2 text-amber-600 font-medium">
                          <div className="h-5 w-5 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">4</div>
                          <div>
                            <strong className="text-foreground block mb-0.5">Alternativ: Registrera med E-post & lösenord</strong>
                            Om du inte kan lägga till fler domäner i Firebase Console (t.ex. på grund av app-gränser), använd **E-post och lösenord** i fliken "Registrera" ovan! Det kräver **ingen domain-verifiering**. Se bara till att du har aktiverat <span className="font-semibold text-foreground">Email/Password</span> som inloggningsmetod i ditt Firebase-projekt (Authentication &rarr; Sign-in method).
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </Layout>
  );
}
