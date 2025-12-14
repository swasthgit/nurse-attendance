"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
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
import { Stethoscope, Building2, Lock, Eye, EyeOff, MapPin } from "lucide-react";

type LocationResult = {
  latitude: number | null;
  longitude: number | null;
  source: "browser" | "ip" | "unavailable";
  message?: string;
};

export default function NurseLoginPage() {
  const router = useRouter();
  const [clinicId, setClinicId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchIpLocation = async (): Promise<LocationResult | null> => {
    try {
      const response = await fetch("https://ipapi.co/json/");
      if (!response.ok) throw new Error("Unable to fetch IP location");
      const data = await response.json();
      if (typeof data.latitude === "number" && typeof data.longitude === "number") {
        return {
          latitude: data.latitude,
          longitude: data.longitude,
          source: "ip",
          message: "Approximate location detected via IP",
        };
      }
    } catch (err) {
      console.error("IP location error:", err);
    }
    return null;
  };

  const getLocation = async (): Promise<LocationResult> => {
    if (typeof navigator === "undefined") {
      return { latitude: null, longitude: null, source: "unavailable", message: "Navigator unavailable" };
    }

    if (navigator.geolocation) {
      const browserLocation = await new Promise<LocationResult>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              source: "browser",
            });
          },
          (error) => {
            resolve({
              latitude: null,
              longitude: null,
              source: "unavailable",
              message: error.message || "Browser location denied",
            });
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });

      if (browserLocation.latitude !== null && browserLocation.longitude !== null) {
        return browserLocation;
      }
    }

    const ipLocation = await fetchIpLocation();
    if (ipLocation) return ipLocation;

    return { latitude: null, longitude: null, source: "unavailable", message: "Location not available" };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const email = `${clinicId.toLowerCase()}@nurses-attendance.com`;
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const nurseDoc = await getDoc(doc(db, "nurses", clinicId.toUpperCase()));
      if (!nurseDoc.exists()) throw new Error("Nurse data not found");

      const nurseData = nurseDoc.data();
      const location = await getLocation();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);

      const clinicDocRef = doc(db, "attendance", clinicId.toUpperCase());
      await setDoc(clinicDocRef, {
        clinicId: clinicId.toUpperCase(),
        odId: user.uid,
        nurseName: nurseData.nurseName,
        lastLoginTime: serverTimestamp(),
        lastLoginTimeLocal: now.toISOString(),
      }, { merge: true });

      await addDoc(collection(clinicDocRef, "logins"), {
        loginTime: serverTimestamp(),
        loginTimeLocal: now.toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        locationSource: location.source,
        locationMessage: location.message || null,
        sessionExpiresAt: expiresAt.toISOString(),
        userAgent: navigator.userAgent,
      });

      const session = {
        odId: user.uid,
        clinicId: clinicId.toUpperCase(),
        nurseName: nurseData.nurseName,
        nursePhone: nurseData.nursePhone || "",
        clinicAddress: nurseData.clinicAddress,
        clinicType: nurseData.clinicType,
        partnerName: nurseData.partnerName,
        region: nurseData.region,
        state: nurseData.state,
        nurseType: nurseData.nurseType || "",
        nurseEmpId: nurseData.nurseEmpId || "",
        loginTime: now.toLocaleString(),
        location,
        sessionExpiresAt: expiresAt.toISOString(),
      };

      localStorage.setItem("nurseSession", JSON.stringify(session));
      router.push("/dashboard");
    } catch (err: unknown) {
      console.error("Login error:", err);
      if (err instanceof Error) {
        if (err.message.includes("auth/invalid-credential") || err.message.includes("auth/wrong-password")) {
          setError("Invalid Clinic ID or Password");
        } else if (err.message.includes("auth/user-not-found")) {
          setError("Clinic ID not found. Please check your Clinic ID.");
        } else if (err.message.includes("auth/invalid-email")) {
          setError("Invalid Clinic ID format. Please enter a valid Clinic ID.");
        } else if (err.message.includes("auth/too-many-requests")) {
          setError("Too many failed attempts. Please try again later.");
        } else {
          setError("Login failed. Please try again.");
        }
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />

      <Card className="w-full max-w-md bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-[0_35px_120px_rgba(0,0,0,0.65)] relative z-10 rounded-[32px] p-8 sm:p-10">
        <CardHeader className="text-center pb-4 px-0">
          <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-white tracking-tight">
            Nurse Login Portal
          </CardTitle>
          <CardDescription className="text-neutral-400 mt-2">
            Enter your Clinic ID to sign in
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-6 px-0">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="clinicId" className="text-neutral-300 text-sm font-medium">
                Clinic ID
              </Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  id="clinicId"
                  type="text"
                  placeholder="e.g., ECCM038"
                  value={clinicId}
                  onChange={(e) => setClinicId(e.target.value.toUpperCase())}
                  className="pl-10 bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11 uppercase"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-neutral-300 text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-500 focus:border-emerald-500/50 focus:ring-emerald-500/20 h-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-neutral-800/30 rounded-lg border border-neutral-700/30">
              <MapPin className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-neutral-400 leading-relaxed">
                Upon login, we'll request your location to verify your shift attendance.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                "Sign In"
              )}
            </Button>

            <p className="text-center text-xs text-neutral-500 pt-2">
              Sessions expire after 2 hours for security purposes
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="absolute bottom-4 text-center text-xs text-neutral-600">
        <p>© 2024 Healthcare Portal. All rights reserved.</p>
      </div>
    </div>
  );
}
