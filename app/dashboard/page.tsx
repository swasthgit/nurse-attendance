"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
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
  LogIn,
  CheckCircle2,
  X,
  Loader2,
  FileText,
  Camera,
  Upload,
  Image,
  Users,
} from "lucide-react";

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
}

interface PunchRecord {
  clinicId: string;
  nurseName: string;
  date: string;
  punchIn: {
    timestamp: string;
    latitude: number | null;
    longitude: number | null;
    source: string;
  } | null;
  punchOut: {
    timestamp: string;
    latitude: number | null;
    longitude: number | null;
    source: string;
  } | null;
  status: "punched_in" | "completed";
  // Post punch-out form data
  consultationCount?: number;
  registerImage?: string; // Base64 or URL
  campPhotos?: string[]; // Array of Base64 or URLs
  formSubmitted?: boolean;
}

interface PopupState {
  show: boolean;
  type: "punch_in" | "punch_out" | "confirm_punch_in" | "confirm_punch_out" | null;
  loading: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const [nurseData, setNurseData] = useState<NurseSession | null>(null);
  const [punchRecord, setPunchRecord] = useState<PunchRecord | null>(null);
  const [popup, setPopup] = useState<PopupState>({ show: false, type: null, loading: false });
  const [locationError, setLocationError] = useState<string | null>(null);

  // Post punch-out form state
  const [showPostForm, setShowPostForm] = useState(false);
  const [consultationCount, setConsultationCount] = useState<string>("");
  const [registerImage, setRegisterImage] = useState<string | null>(null);
  const [campPhotos, setCampPhotos] = useState<string[]>([]);
  const [formSubmitting, setFormSubmitting] = useState(false);

  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  const getLocation = useCallback(async (): Promise<{ latitude: number | null; longitude: number | null; source: string }> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ latitude: null, longitude: null, source: "unavailable" });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            source: "browser",
          });
        },
        async () => {
          // Fallback to IP-based location
          try {
            const response = await fetch("https://ipapi.co/json/");
            const data = await response.json();
            resolve({
              latitude: data.latitude || null,
              longitude: data.longitude || null,
              source: "ip",
            });
          } catch {
            resolve({ latitude: null, longitude: null, source: "unavailable" });
          }
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  const loadPunchRecord = useCallback(async (clinicId: string) => {
    const today = getTodayDate();
    const localKey = `punchRecord_${clinicId}_${today}`;

    // Check localStorage first
    const localRecord = localStorage.getItem(localKey);
    if (localRecord) {
      const record = JSON.parse(localRecord) as PunchRecord;
      setPunchRecord(record);
      // Load form data if exists
      if (record.consultationCount !== undefined) {
        setConsultationCount(record.consultationCount.toString());
      }
      if (record.registerImage) {
        setRegisterImage(record.registerImage);
      }
      if (record.campPhotos) {
        setCampPhotos(record.campPhotos);
      }
      return;
    }

    // Check Firestore
    try {
      const docRef = doc(db, "camps", clinicId, "records", today);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const record = docSnap.data() as PunchRecord;
        setPunchRecord(record);
        localStorage.setItem(localKey, JSON.stringify(record));
        // Load form data if exists
        if (record.consultationCount !== undefined) {
          setConsultationCount(record.consultationCount.toString());
        }
        if (record.registerImage) {
          setRegisterImage(record.registerImage);
        }
        if (record.campPhotos) {
          setCampPhotos(record.campPhotos);
        }
      }
    } catch (error) {
      console.error("Error loading punch record:", error);
    }
  }, []);

  useEffect(() => {
    const storedData = localStorage.getItem("nurseSession");
    if (!storedData) {
      router.push("/");
      return;
    }

    const data = JSON.parse(storedData) as NurseSession;
    setNurseData(data);
    loadPunchRecord(data.clinicId);
  }, [router, loadPunchRecord]);

  const savePunchRecord = async (record: PunchRecord) => {
    const today = getTodayDate();
    const localKey = `punchRecord_${record.clinicId}_${today}`;

    // Save to localStorage
    localStorage.setItem(localKey, JSON.stringify(record));

    // Save to Firestore
    try {
      const docRef = doc(db, "camps", record.clinicId, "records", today);
      console.log("Saving punch record to:", `camps/${record.clinicId}/records/${today}`);
      await setDoc(docRef, record, { merge: true });
      console.log("Punch record saved successfully!");
    } catch (error) {
      console.error("Error saving punch record to Firestore:", error);
      alert("Failed to save to server. Data saved locally only. Error: " + (error as Error).message);
    }
  };

  const handlePunchIn = async () => {
    if (!nurseData) return;

    setPopup({ show: true, type: "confirm_punch_in", loading: true });
    setLocationError(null);

    const location = await getLocation();

    if (location.latitude === null || location.longitude === null) {
      setLocationError("Unable to get your location. Please enable location services and try again.");
      setPopup({ show: true, type: "confirm_punch_in", loading: false });
      return;
    }

    const today = getTodayDate();
    const record: PunchRecord = {
      clinicId: nurseData.clinicId,
      nurseName: nurseData.nurseName,
      date: today,
      punchIn: {
        timestamp: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
      },
      punchOut: null,
      status: "punched_in",
    };

    await savePunchRecord(record);
    setPunchRecord(record);
    setPopup({ show: true, type: "punch_in", loading: false });
  };

  const handlePunchOut = async () => {
    if (!nurseData || !punchRecord) return;

    setPopup({ show: true, type: "confirm_punch_out", loading: true });
    setLocationError(null);

    const location = await getLocation();

    if (location.latitude === null || location.longitude === null) {
      setLocationError("Unable to get your location. Please enable location services and try again.");
      setPopup({ show: true, type: "confirm_punch_out", loading: false });
      return;
    }

    const updatedRecord: PunchRecord = {
      ...punchRecord,
      punchOut: {
        timestamp: new Date().toISOString(),
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
      },
      status: "completed",
    };

    const today = getTodayDate();
    const localKey = `punchRecord_${nurseData.clinicId}_${today}`;
    localStorage.setItem(localKey, JSON.stringify(updatedRecord));

    try {
      const docRef = doc(db, "camps", nurseData.clinicId, "records", today);
      await updateDoc(docRef, {
        punchOut: updatedRecord.punchOut,
        status: "completed",
      });
    } catch (error) {
      console.error("Error updating punch record:", error);
    }

    setPunchRecord(updatedRecord);
    setPopup({ show: true, type: "punch_out", loading: false });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
    localStorage.removeItem("nurseSession");
    router.push("/");
  };

  const closePopup = () => {
    setPopup({ show: false, type: null, loading: false });
    setLocationError(null);
  };

  // Handle image file to base64 conversion
  const handleImageUpload = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Compress image if too large (max 500KB)
        const img = document.createElement("img");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxSize = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxSize || height > maxSize) {
            if (width > height) {
              height = (height / width) * maxSize;
              width = maxSize;
            } else {
              width = (width / height) * maxSize;
              height = maxSize;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.onerror = reject;
        img.src = reader.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRegisterImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const base64 = await handleImageUpload(file);
        setRegisterImage(base64);
      } catch (error) {
        console.error("Error uploading register image:", error);
        alert("Failed to upload image. Please try again.");
      }
    }
  };

  const handleCampPhotosChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      try {
        const newPhotos: string[] = [];
        for (let i = 0; i < Math.min(files.length, 5); i++) {
          const base64 = await handleImageUpload(files[i]);
          newPhotos.push(base64);
        }
        setCampPhotos((prev) => [...prev, ...newPhotos].slice(0, 5));
      } catch (error) {
        console.error("Error uploading camp photos:", error);
        alert("Failed to upload photos. Please try again.");
      }
    }
  };

  const removeCampPhoto = (index: number) => {
    setCampPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFormSubmit = async () => {
    if (!nurseData || !punchRecord) return;

    // Consultation count is required
    if (!consultationCount || parseInt(consultationCount) < 0) {
      alert("Please enter a valid consultation count / कृपया वैध परामर्श संख्या दर्ज करें");
      return;
    }

    setFormSubmitting(true);

    const today = getTodayDate();
    const localKey = `punchRecord_${nurseData.clinicId}_${today}`;

    const updatedRecord: PunchRecord = {
      ...punchRecord,
      consultationCount: parseInt(consultationCount),
      registerImage: registerImage || undefined,
      campPhotos: campPhotos.length > 0 ? campPhotos : undefined,
      formSubmitted: true,
    };

    // Save to localStorage
    localStorage.setItem(localKey, JSON.stringify(updatedRecord));

    // Save to Firestore
    try {
      const docRef = doc(db, "camps", nurseData.clinicId, "records", today);
      await updateDoc(docRef, {
        consultationCount: updatedRecord.consultationCount,
        registerImage: updatedRecord.registerImage || null,
        campPhotos: updatedRecord.campPhotos || null,
        formSubmitted: true,
      });

      setPunchRecord(updatedRecord);
      setShowPostForm(false);
      alert("Form submitted successfully! / फॉर्म सफलतापूर्वक जमा हो गया!");
    } catch (error) {
      console.error("Error submitting form:", error);
      // Data saved locally, will sync later
      setPunchRecord(updatedRecord);
      setShowPostForm(false);
      alert("Form saved locally. Will sync when online. / फॉर्म स्थानीय रूप से सहेजा गया। ऑनलाइन होने पर सिंक होगा।");
    }

    setFormSubmitting(false);
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (!nurseData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  const hasPunchedIn = punchRecord?.status === "punched_in";
  const hasCompleted = punchRecord?.status === "completed";

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
              <p className="text-sm text-neutral-400">Camp Attendance</p>
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
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${
              hasCompleted
                ? "bg-green-500/10 border border-green-500/30"
                : hasPunchedIn
                  ? "bg-amber-500/10 border border-amber-500/30"
                  : "bg-neutral-500/10 border border-neutral-500/30"
            }`}>
              <Activity className={`w-4 h-4 ${
                hasCompleted ? "text-green-400" : hasPunchedIn ? "text-amber-400" : "text-neutral-400"
              }`} />
              <span className={`text-sm font-medium ${
                hasCompleted ? "text-green-400" : hasPunchedIn ? "text-amber-400" : "text-neutral-400"
              }`}>
                {hasCompleted ? "Completed" : hasPunchedIn ? "Punched In" : "Not Punched In"}
              </span>
            </div>
          </div>
        </Card>

        {/* Punch In/Out Section */}
        <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6 mb-6">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-400" />
              Camp Attendance
            </CardTitle>
            <CardDescription className="text-neutral-500">
              {getTodayDate()} - Mark your attendance for today&apos;s camp
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {hasCompleted ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <span className="text-green-400 font-medium">Today&apos;s attendance completed</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-neutral-800/30 rounded-lg">
                      <p className="text-xs text-neutral-500 mb-1">Punch In</p>
                      <p className="text-sm text-white">{formatTime(punchRecord!.punchIn!.timestamp)}</p>
                      <p className="text-xs text-neutral-400 font-mono mt-1">
                        {punchRecord!.punchIn!.latitude?.toFixed(6)}, {punchRecord!.punchIn!.longitude?.toFixed(6)}
                      </p>
                    </div>
                    <div className="p-3 bg-neutral-800/30 rounded-lg">
                      <p className="text-xs text-neutral-500 mb-1">Punch Out</p>
                      <p className="text-sm text-white">{formatTime(punchRecord!.punchOut!.timestamp)}</p>
                      <p className="text-xs text-neutral-400 font-mono mt-1">
                        {punchRecord!.punchOut!.latitude?.toFixed(6)}, {punchRecord!.punchOut!.longitude?.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Post Punch-Out Form or Summary */}
                {punchRecord?.formSubmitted ? (
                  <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-3">
                      <FileText className="w-5 h-5 text-blue-400" />
                      <span className="text-blue-400 font-medium">Camp Details Submitted / शिविर विवरण जमा</span>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-white">
                        <span className="text-neutral-400">Consultations / परामर्श:</span>{" "}
                        <span className="font-semibold text-emerald-400">{punchRecord.consultationCount}</span>
                      </p>
                      {punchRecord.registerImage && (
                        <p className="text-sm text-neutral-400">✓ Register image uploaded / रजिस्टर छवि अपलोड</p>
                      )}
                      {punchRecord.campPhotos && punchRecord.campPhotos.length > 0 && (
                        <p className="text-sm text-neutral-400">✓ {punchRecord.campPhotos.length} camp photo(s) uploaded / शिविर फोटो अपलोड</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-amber-400" />
                      <span className="text-amber-400 font-medium">
                        Submit Camp Details / शिविर विवरण जमा करें
                      </span>
                    </div>
                    <p className="text-sm text-neutral-400 mb-3">
                      Please submit the camp consultation details before the day ends.
                      <br />
                      कृपया दिन समाप्त होने से पहले शिविर परामर्श विवरण जमा करें।
                    </p>
                    <Button
                      onClick={() => setShowPostForm(true)}
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      Fill Camp Details / विवरण भरें
                    </Button>
                  </div>
                )}
              </div>
            ) : hasPunchedIn ? (
              <div className="space-y-4">
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-5 h-5 text-amber-400" />
                    <span className="text-amber-400 font-medium">You are punched in</span>
                  </div>
                  <p className="text-sm text-neutral-400">
                    Punched in at: {formatTime(punchRecord!.punchIn!.timestamp)}
                  </p>
                  <p className="text-xs text-neutral-500 font-mono mt-1">
                    Location: {punchRecord!.punchIn!.latitude?.toFixed(6)}, {punchRecord!.punchIn!.longitude?.toFixed(6)}
                  </p>
                </div>
                <Button
                  onClick={handlePunchOut}
                  className="w-full h-14 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold text-lg rounded-xl shadow-lg shadow-red-500/20"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Punch Out
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-neutral-800/30 border border-neutral-700/30 rounded-xl">
                  <p className="text-neutral-400 text-sm">
                    Click the button below to punch in for today&apos;s camp. Your location will be recorded.
                  </p>
                </div>
                <Button
                  onClick={handlePunchIn}
                  className="w-full h-14 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold text-lg rounded-xl shadow-lg shadow-emerald-500/20"
                >
                  <LogIn className="w-5 h-5 mr-2" />
                  Punch In
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <BadgeCheck className="w-5 h-5 text-emerald-400" />
                Nurse Credentials
              </CardTitle>
              <CardDescription className="text-neutral-500">Your account information</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
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
            </CardContent>
          </Card>

          <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
                <MapPinned className="w-5 h-5 text-teal-400" />
                Clinic Details
              </CardTitle>
              <CardDescription className="text-neutral-500">Your assigned clinic</CardDescription>
            </CardHeader>
            <CardContent className="p-0 space-y-3">
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

              <div className="flex items-center gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <MapPin className="w-4 h-4 text-neutral-500" />
                <div>
                  <p className="text-xs text-neutral-500">Region / State</p>
                  <p className="text-sm font-medium text-white">{nurseData.region}, {nurseData.state}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-neutral-800/30 rounded-xl border border-neutral-700/30">
                <MapPinned className="w-4 h-4 text-neutral-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-neutral-500">Clinic Address</p>
                  <p className="text-sm font-medium text-white">{nurseData.clinicAddress}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-neutral-900/80 backdrop-blur-2xl border border-neutral-800/60 shadow-xl rounded-[20px] p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/30 flex-shrink-0">
              <Calendar className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white mb-1">Camp Attendance Instructions</h3>
              <p className="text-sm text-neutral-400 leading-relaxed">
                Punch in when you arrive at the camp location and punch out when you leave.
                Your location is recorded for verification purposes. You can punch in/out once per day.
              </p>
            </div>
          </div>
        </Card>

        <div className="mt-8 text-center text-xs text-neutral-600">
          <p>© 2024 Healthcare Portal. All rights reserved.</p>
        </div>
      </div>

      {/* Popup Modal */}
      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            {popup.loading ? (
              <div className="flex flex-col items-center py-8">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                <p className="text-white font-medium">Getting your location...</p>
                <p className="text-neutral-400 text-sm mt-1">Please wait</p>
              </div>
            ) : locationError ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <X className="w-8 h-8 text-red-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Location Error</h3>
                <p className="text-neutral-400 text-sm text-center mb-4">{locationError}</p>
                <Button
                  onClick={closePopup}
                  className="bg-neutral-800 hover:bg-neutral-700 text-white"
                >
                  Close
                </Button>
              </div>
            ) : popup.type === "punch_in" ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Punched In Successfully!</h3>
                <p className="text-neutral-400 text-sm text-center mb-4">
                  Your attendance has been recorded. Remember to punch out when you leave.
                </p>
                <Button
                  onClick={closePopup}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white"
                >
                  Got it
                </Button>
              </div>
            ) : popup.type === "punch_out" ? (
              <div className="flex flex-col items-center py-4">
                <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">Punched Out Successfully!</h3>
                <p className="text-neutral-400 text-sm text-center mb-4">
                  Your camp attendance for today has been completed. Thank you!
                </p>
                <Button
                  onClick={closePopup}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  Done
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Post Punch-Out Form Modal */}
      {showPostForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <FileText className="w-6 h-6 text-emerald-400" />
                Camp Details / शिविर विवरण
              </h2>
              <button
                onClick={() => setShowPostForm(false)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Consultation Count */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <Users className="w-4 h-4 inline mr-2 text-emerald-400" />
                  Number of Consultations * / परामर्श की संख्या *
                </label>
                <input
                  type="number"
                  min="0"
                  value={consultationCount}
                  onChange={(e) => setConsultationCount(e.target.value)}
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter number / संख्या दर्ज करें"
                />
                <p className="text-xs text-neutral-500 mt-1">
                  Total consultations done at the camp today / आज शिविर में किए गए कुल परामर्श
                </p>
              </div>

              {/* Register Image Upload */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <Camera className="w-4 h-4 inline mr-2 text-blue-400" />
                  Register Photo (Optional) / रजिस्टर फोटो (वैकल्पिक)
                </label>
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg mb-3">
                  <p className="text-xs text-amber-300">
                    <strong>Disclaimer / अस्वीकरण:</strong>
                  </p>
                  <p className="text-xs text-neutral-300 mt-1">
                    Upload the photo of the register where you have recorded the participant details for this camp.
                  </p>
                  <p className="text-xs text-neutral-400 mt-1">
                    इस शिविर के लिए प्रतिभागियों के विवरण दर्ज करने वाले रजिस्टर की फोटो अपलोड करें।
                  </p>
                </div>

                {registerImage ? (
                  <div className="relative">
                    <img
                      src={registerImage}
                      alt="Register"
                      className="w-full h-40 object-cover rounded-xl border border-neutral-700"
                    />
                    <button
                      onClick={() => setRegisterImage(null)}
                      className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-emerald-500/50 transition-colors">
                    <Upload className="w-8 h-8 text-neutral-500 mb-2" />
                    <span className="text-sm text-neutral-400">Click to upload / अपलोड करने के लिए क्लिक करें</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleRegisterImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Camp Photos Upload */}
              <div>
                <label className="block text-sm font-medium text-white mb-2">
                  <Image className="w-4 h-4 inline mr-2 text-purple-400" />
                  Camp Photos (Optional) / शिविर फोटो (वैकल्पिक)
                </label>
                <p className="text-xs text-neutral-400 mb-3">
                  Upload photos of the camp (max 5). These are optional.
                  <br />
                  शिविर की फोटो अपलोड करें (अधिकतम 5)। ये वैकल्पिक हैं।
                </p>

                {campPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {campPhotos.map((photo, index) => (
                      <div key={index} className="relative">
                        <img
                          src={photo}
                          alt={`Camp photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-neutral-700"
                        />
                        <button
                          onClick={() => removeCampPhoto(index)}
                          className="absolute -top-1 -right-1 p-0.5 bg-red-500 rounded-full text-white hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {campPhotos.length < 5 && (
                  <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-neutral-700 rounded-xl cursor-pointer hover:border-purple-500/50 transition-colors">
                    <Camera className="w-6 h-6 text-neutral-500 mb-1" />
                    <span className="text-xs text-neutral-400">Add photos / फोटो जोड़ें ({campPhotos.length}/5)</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      multiple
                      onChange={handleCampPhotosChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Note about optional uploads */}
              <div className="p-3 bg-neutral-800/50 border border-neutral-700/50 rounded-lg">
                <p className="text-xs text-neutral-400">
                  <strong>Note:</strong> Image uploads are optional. You can submit the form with just the consultation count if you have internet issues.
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  <strong>नोट:</strong> छवि अपलोड वैकल्पिक हैं। यदि इंटरनेट की समस्या है तो आप केवल परामर्श संख्या के साथ फॉर्म जमा कर सकते हैं।
                </p>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3">
                <Button
                  onClick={() => setShowPostForm(false)}
                  variant="outline"
                  className="flex-1 bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700"
                >
                  Cancel / रद्द करें
                </Button>
                <Button
                  onClick={handleFormSubmit}
                  disabled={formSubmitting || !consultationCount}
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold"
                >
                  {formSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Submit / जमा करें
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
