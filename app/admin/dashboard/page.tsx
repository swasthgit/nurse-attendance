"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { collection, collectionGroup, getDocs, query, orderBy } from "firebase/firestore";
import { signOut } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Shield,
  LogOut,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  Calendar,
  MapPin,
  RefreshCw,
  Download,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Navigation,
  FileText,
  Image,
  Eye,
  X,
} from "lucide-react";

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
  registerImage?: string;
  campPhotos?: string[];
  formSubmitted?: boolean;
}

interface NurseInfo {
  clinicId: string;
  nurseName: string;
  region: string;
  state: string;
  partnerName: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [records, setRecords] = useState<PunchRecord[]>([]);
  const [nurses, setNurses] = useState<Map<string, NurseInfo>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 20;
  const [viewingImages, setViewingImages] = useState<{
    type: "register" | "camp";
    images: string[];
    recordId: string;
  } | null>(null);

  const fetchNurses = useCallback(async () => {
    try {
      const nursesSnapshot = await getDocs(collection(db, "nurses"));
      const nursesMap = new Map<string, NurseInfo>();
      nursesSnapshot.forEach((doc) => {
        const data = doc.data();
        nursesMap.set(doc.id, {
          clinicId: doc.id,
          nurseName: data.nurseName || "",
          region: data.region || "",
          state: data.state || "",
          partnerName: data.partnerName || "",
        });
      });
      setNurses(nursesMap);
    } catch (error) {
      console.error("Error fetching nurses:", error);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      // Use collectionGroup to query all "records" subcollections across all camps
      // Note: Don't use orderBy to avoid needing an index (we sort client-side)
      const recordsRef = collectionGroup(db, "records");
      const recordsSnapshot = await getDocs(recordsRef);
      const allRecords: PunchRecord[] = [];

      console.log("Fetched records count:", recordsSnapshot.size);

      recordsSnapshot.forEach((recordDoc) => {
        const data = recordDoc.data() as PunchRecord;
        // Get clinicId from the document data (we store it in the record)
        allRecords.push({
          ...data,
          clinicId: data.clinicId || "",
        });
      });

      // Sort by date descending, then by punch-in time (client-side sorting)
      allRecords.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        const aTime = a.punchIn?.timestamp || "";
        const bTime = b.punchIn?.timestamp || "";
        return bTime.localeCompare(aTime);
      });

      setRecords(allRecords);
    } catch (error) {
      console.error("Error fetching records:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const adminSession = localStorage.getItem("adminSession");
    if (!adminSession) {
      router.push("/admin");
      return;
    }

    fetchNurses();
    fetchRecords();
  }, [router, fetchNurses, fetchRecords]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Sign out error:", error);
    }
    localStorage.removeItem("adminSession");
    router.push("/admin");
  };

  const handleRefresh = () => {
    fetchRecords();
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleString("en-IN", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const formatCoords = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return "N/A";
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Generate Google Maps URL for a location
  const getGoogleMapsUrl = (lat: number | null, lng: number | null) => {
    if (lat === null || lng === null) return null;
    return `https://www.google.com/maps?q=${lat},${lng}`;
  };

  // Haversine formula to calculate distance between two points in km
  const calculateDistance = (
    lat1: number | null,
    lng1: number | null,
    lat2: number | null,
    lng2: number | null
  ): number | null => {
    if (lat1 === null || lng1 === null || lat2 === null || lng2 === null) {
      return null;
    }

    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
  };

  // Format distance for display
  const formatDistance = (distance: number | null): string => {
    if (distance === null) return "-";
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)} m`;
    }
    return `${distance.toFixed(2)} km`;
  };

  // Filter records by date and search query
  const filteredRecords = records.filter((record) => {
    const matchesDate = record.date === selectedDate;
    const matchesSearch =
      searchQuery === "" ||
      record.clinicId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.nurseName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nurses.get(record.clinicId)?.region?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      nurses.get(record.clinicId)?.state?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesDate && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / recordsPerPage);
  const paginatedRecords = filteredRecords.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Stats for selected date
  const totalToday = filteredRecords.length;
  const completedToday = filteredRecords.filter((r) => r.status === "completed").length;
  const punchedInToday = filteredRecords.filter((r) => r.status === "punched_in").length;

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "Date",
      "Clinic ID",
      "Nurse Name",
      "Region",
      "State",
      "Partner",
      "Punch In Time",
      "Punch In Location",
      "Punch In Map Link",
      "Punch Out Time",
      "Punch Out Location",
      "Punch Out Map Link",
      "Distance (km)",
      "Consultations",
      "Register Image",
      "Camp Photos",
      "Form Submitted",
      "Status",
    ];

    const rows = filteredRecords.map((record) => {
      const nurse = nurses.get(record.clinicId);
      const distance = record.punchIn && record.punchOut
        ? calculateDistance(
            record.punchIn.latitude,
            record.punchIn.longitude,
            record.punchOut.latitude,
            record.punchOut.longitude
          )
        : null;
      return [
        record.date,
        record.clinicId,
        record.nurseName,
        nurse?.region || "",
        nurse?.state || "",
        nurse?.partnerName || "",
        record.punchIn ? formatTime(record.punchIn.timestamp) : "",
        record.punchIn ? formatCoords(record.punchIn.latitude, record.punchIn.longitude) : "",
        record.punchIn ? getGoogleMapsUrl(record.punchIn.latitude, record.punchIn.longitude) || "" : "",
        record.punchOut ? formatTime(record.punchOut.timestamp) : "",
        record.punchOut ? formatCoords(record.punchOut.latitude, record.punchOut.longitude) : "",
        record.punchOut ? getGoogleMapsUrl(record.punchOut.latitude, record.punchOut.longitude) || "" : "",
        distance !== null ? distance.toFixed(3) : "",
        record.consultationCount !== undefined ? record.consultationCount.toString() : "",
        record.registerImage ? "Yes" : "No",
        record.campPhotos ? record.campPhotos.length.toString() : "0",
        record.formSubmitted ? "Yes" : "No",
        record.status,
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `camp-attendance-${selectedDate}.csv`;
    link.click();
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-neutral-400">Loading attendance data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-950 to-neutral-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Dashboard</h1>
              <p className="text-sm text-neutral-400">Camp Attendance Management</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleRefresh}
              variant="outline"
              className="bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/50 hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={handleLogout}
              variant="outline"
              className="bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/50 hover:text-white"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{totalToday}</p>
                <p className="text-xs text-neutral-400">Total Records</p>
              </div>
            </div>
          </Card>

          <Card className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{completedToday}</p>
                <p className="text-xs text-neutral-400">Completed</p>
              </div>
            </div>
          </Card>

          <Card className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{punchedInToday}</p>
                <p className="text-xs text-neutral-400">Punched In (Pending)</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/60 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-neutral-500" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-neutral-800/50 border-neutral-700/50 text-white w-full sm:w-auto"
              />
            </div>

            <div className="flex items-center gap-2 flex-1">
              <Search className="w-4 h-4 text-neutral-500" />
              <Input
                type="text"
                placeholder="Search by Clinic ID, Name, Region..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-neutral-800/50 border-neutral-700/50 text-white placeholder:text-neutral-500"
              />
            </div>

            <Button
              onClick={exportToCSV}
              className="bg-green-600 hover:bg-green-500 text-white"
              disabled={filteredRecords.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </Card>

        {/* Records Table */}
        <Card className="bg-neutral-900/80 backdrop-blur-xl border border-neutral-800/60 rounded-xl overflow-hidden">
          <CardHeader className="border-b border-neutral-800/60 p-4">
            <CardTitle className="text-lg font-semibold text-white">
              Attendance Records
            </CardTitle>
            <CardDescription className="text-neutral-500">
              {selectedDate} - {filteredRecords.length} records found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredRecords.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <XCircle className="w-12 h-12 text-neutral-600 mb-4" />
                <p className="text-neutral-400">No records found for selected date</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-800/50">
                      <tr>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Clinic ID
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Nurse Name
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden md:table-cell">
                          Region
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Punch In
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Punch Out
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">
                          Distance
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden lg:table-cell">
                          Consultations
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider hidden xl:table-cell">
                          Images
                        </th>
                        <th className="text-left p-3 text-xs font-medium text-neutral-400 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/50">
                      {paginatedRecords.map((record, index) => {
                        const nurse = nurses.get(record.clinicId);
                        return (
                          <tr
                            key={`${record.clinicId}-${record.date}-${index}`}
                            className="hover:bg-neutral-800/30 transition-colors"
                          >
                            <td className="p-3">
                              <span className="text-emerald-400 font-mono text-sm">
                                {record.clinicId}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="text-white text-sm">{record.nurseName}</span>
                            </td>
                            <td className="p-3 hidden md:table-cell">
                              <span className="text-neutral-400 text-sm">
                                {nurse?.region || "N/A"}, {nurse?.state || ""}
                              </span>
                            </td>
                            <td className="p-3">
                              {record.punchIn ? (
                                <div>
                                  <p className="text-white text-sm">
                                    {formatTime(record.punchIn.timestamp)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-neutral-500 text-xs flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {formatCoords(record.punchIn.latitude, record.punchIn.longitude)}
                                    </p>
                                    {getGoogleMapsUrl(record.punchIn.latitude, record.punchIn.longitude) && (
                                      <a
                                        href={getGoogleMapsUrl(record.punchIn.latitude, record.punchIn.longitude)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                        title="View on Google Maps"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="p-3">
                              {record.punchOut ? (
                                <div>
                                  <p className="text-white text-sm">
                                    {formatTime(record.punchOut.timestamp)}
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <p className="text-neutral-500 text-xs flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {formatCoords(record.punchOut.latitude, record.punchOut.longitude)}
                                    </p>
                                    {getGoogleMapsUrl(record.punchOut.latitude, record.punchOut.longitude) && (
                                      <a
                                        href={getGoogleMapsUrl(record.punchOut.latitude, record.punchOut.longitude)!}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                        title="View on Google Maps"
                                      >
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-neutral-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              {record.punchIn && record.punchOut ? (
                                <div className="flex items-center gap-1">
                                  <Navigation className="w-3 h-3 text-cyan-400" />
                                  <span className="text-cyan-400 text-sm font-medium">
                                    {formatDistance(
                                      calculateDistance(
                                        record.punchIn.latitude,
                                        record.punchIn.longitude,
                                        record.punchOut.latitude,
                                        record.punchOut.longitude
                                      )
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-neutral-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="p-3 hidden lg:table-cell">
                              {record.consultationCount !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <Users className="w-3 h-3 text-purple-400" />
                                  <span className="text-purple-400 text-sm font-medium">
                                    {record.consultationCount}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-neutral-500 text-sm">-</span>
                              )}
                            </td>
                            <td className="p-3 hidden xl:table-cell">
                              <div className="flex items-center gap-2">
                                {record.registerImage && (
                                  <button
                                    onClick={() => setViewingImages({
                                      type: "register",
                                      images: [record.registerImage!],
                                      recordId: `${record.clinicId}-${record.date}`,
                                    })}
                                    className="flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs hover:bg-blue-500/20 transition-colors"
                                    title="View Register Image"
                                  >
                                    <FileText className="w-3 h-3" />
                                    Register
                                  </button>
                                )}
                                {record.campPhotos && record.campPhotos.length > 0 && (
                                  <button
                                    onClick={() => setViewingImages({
                                      type: "camp",
                                      images: record.campPhotos!,
                                      recordId: `${record.clinicId}-${record.date}`,
                                    })}
                                    className="flex items-center gap-1 px-2 py-1 bg-purple-500/10 text-purple-400 rounded text-xs hover:bg-purple-500/20 transition-colors"
                                    title="View Camp Photos"
                                  >
                                    <Image className="w-3 h-3" />
                                    {record.campPhotos.length}
                                  </button>
                                )}
                                {!record.registerImage && (!record.campPhotos || record.campPhotos.length === 0) && (
                                  <span className="text-neutral-500 text-sm">-</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                                  record.status === "completed"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-amber-500/10 text-amber-400"
                                }`}
                              >
                                {record.status === "completed" ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Completed
                                  </>
                                ) : (
                                  <>
                                    <Clock className="w-3 h-3" />
                                    Punched In
                                  </>
                                )}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-neutral-800/60">
                    <p className="text-sm text-neutral-400">
                      Showing {(currentPage - 1) * recordsPerPage + 1} to{" "}
                      {Math.min(currentPage * recordsPerPage, filteredRecords.length)} of{" "}
                      {filteredRecords.length} records
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                        className="bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm text-neutral-400">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                        className="bg-neutral-800/50 border-neutral-700/50 text-neutral-300 hover:bg-neutral-700/50"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <div className="mt-8 text-center text-xs text-neutral-600">
          <p>© 2024 Healthcare Portal. Admin Dashboard.</p>
        </div>
      </div>

      {/* Image Viewing Modal */}
      {viewingImages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 max-w-4xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {viewingImages.type === "register" ? (
                  <>
                    <FileText className="w-5 h-5 text-blue-400" />
                    Register Image
                  </>
                ) : (
                  <>
                    <Image className="w-5 h-5 text-purple-400" />
                    Camp Photos ({viewingImages.images.length})
                  </>
                )}
              </h3>
              <button
                onClick={() => setViewingImages(null)}
                className="text-neutral-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className={`grid gap-4 ${viewingImages.images.length === 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
              {viewingImages.images.map((image, index) => (
                <div key={index} className="relative">
                  <img
                    src={image}
                    alt={`${viewingImages.type === "register" ? "Register" : "Camp photo"} ${index + 1}`}
                    className="w-full rounded-lg border border-neutral-700 max-h-[60vh] object-contain"
                  />
                  <a
                    href={image}
                    download={`${viewingImages.recordId}-${viewingImages.type}-${index + 1}.jpg`}
                    className="absolute bottom-2 right-2 px-3 py-1 bg-neutral-800/90 text-white text-xs rounded-lg hover:bg-neutral-700 transition-colors flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
