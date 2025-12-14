"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Stethoscope,
  User,
  Phone,
  MapPin,
  Clock,
  Building2,
  BadgeCheck,
  LogOut,
  Calendar,
  Activity,
  MapPinned,
  Briefcase,
  Globe,
} from "lucide-react";

type SessionLocation = {
  latitude: number | null;
  longitude: number | null;
  source?: "browser" | "ip" | "unavailable";
  message?: string;
};

interface NurseSession {
  odId: string;
  clinicId: string;
  nurseName: string;
  nursePhone: string;
  clinicAddress: string;
  clinicType: string;
  partnerName: string;
  region: string;
  state: string;
  nurseType: string;
  nurseEmpId: string;
  loginTime: string;
  location?: SessionLocation;
  sessionExpiresAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [nurseData, setNurseData] = useState<NurseSession | null>(null);
  const [timeRemaining, setTimeRemaining] = useState("");

  useEffect(() => {
    const storedData = localStorage.getItem("nurseSession");
    if (!storedData) {
      router.push("/");
      return;
    }

    const data = JSON.parse(storedData) as NurseSession;
    const normalizedLocation: SessionLocation = data.location ?? {
      latitude: null,
      longitude: null,
      source: "unavailable",
      message: "Location not recorded",
    };

    setNurseData({
      ...data,
      location: {
        latitude: normalizedLocation.latitude,
        longitude: normalizedLocation.longitude,
        source: normalizedLocation.source ||
          (normalizedLocation.latitude !== null && normalizedLocation.longitude !== null ? "browser" : "unavailable"),
        message: normalizedLocation.message,
      },
    });

    const updateTimer = () => {
      const expiresAt = new Date(data.sessionExpiresAt).getTime();
      const now = new Date().getTime();
      const diff = expiresAt - now;

      if (diff <= 0) {
        handleLogout();
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
    localStorage.removeItem("nurseSession");
    router.push("/");
  };

  if (!nurseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const hasLocation = !!nurseData.location && nurseData.location.latitude !== null && nurseData.location.longitude !== null;
  const locationMessage = hasLocation
    ? `${nurseData.location!.latitude!.toFixed(6)}, ${nurseData.location!.longitude!.toFixed(6)}`
    : nurseData.location?.message ?? "Location not available";

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 p-4 md:p-8 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className="max-w-5xl mx-auto relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Nurse Portal</h1>
              <p className="text-sm text-neutral-400">Dashboard</p>
            </div>
          </div>

          <Button
            onClick={handleLogout}
            variant="outline"
            className="bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/50 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>

        <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-2xl rounded-[24px] p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <User className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">
                Welcome, {nurseData.nurseName}
              </h2>
              <p className="text-neutral-400">
                Clinic ID: <span className="text-emerald-400 font-mono">{nurseData.clinicId}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-400">Active</span>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6 lg:col-span-2">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-400" />
                Nurse Credentials
              </CardTitle>
              <CardDescription className="text-neutral-500">Your account information</CardDescription>
            </CardHeader>
            <CardContent className="p-0 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <User className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Nurse Name</p>
                  <p className="text-sm font-medium text-white">{nurseData.nurseName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Phone className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Phone Number</p>
                  <p className="text-sm font-medium text-white">{nurseData.nursePhone || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Building2 className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Clinic ID</p>
                  <p className="text-sm font-medium text-emerald-400 font-mono">{nurseData.clinicId}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <BadgeCheck className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Employee ID</p>
                  <p className="text-sm font-medium text-white">{nurseData.nurseEmpId || "N/A"}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Briefcase className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Clinic Type</p>
                  <p className="text-sm font-medium text-white">{nurseData.clinicType}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Globe className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Partner</p>
                  <p className="text-sm font-medium text-white">{nurseData.partnerName}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30 md:col-span-2">
                <MapPinned className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-neutral-500">Clinic Address</p>
                  <p className="text-sm font-medium text-white">{nurseData.clinicAddress}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <MapPin className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Region</p>
                  <p className="text-sm font-medium text-white">{nurseData.region}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Globe className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">State</p>
                  <p className="text-sm font-medium text-white">{nurseData.state}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-teal-400" />
                Session Details
              </CardTitle>
              <CardDescription className="text-neutral-500">Current login info</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <Calendar className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Login Time</p>
                  <p className="text-sm font-medium text-white">{nurseData.loginTime}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <MapPin className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Login Location</p>
                  <p className={hasLocation ? "text-sm font-medium text-white font-mono" : "text-sm font-medium text-amber-400"}>
                    {locationMessage}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
                <Activity className="w-4 h-4 text-amber-400" />
                <div>
                  <p className="text-xs text-amber-400/80">Session Expires In</p>
                  <p className="text-lg font-bold text-amber-400">{timeRemaining}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/30 flex-shrink-0">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Session Security Notice</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                For security purposes, your session will expire after 2 hours.
                You will be required to re-authenticate to continue accessing the portal.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-xs text-neutral-600">
          <p>© 2024 Healthcare Portal. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}
