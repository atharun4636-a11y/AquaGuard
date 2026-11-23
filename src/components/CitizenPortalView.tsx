import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  FilePlus2,
  MapPin,
  PhoneCall,
  Upload,
} from 'lucide-react';
import { useAquaGuard } from '../context/AquaGuardContext';
import { IncidentStatus, RiskLevel } from '../types/aquaguard';
import { validateIncidentInput } from '../utils/riskEngine';
import {
  IncidentStatusBadge,
  KpiCard,
  RiskLabel,
  SectionHeader,
} from './UiPrimitives';

export const CitizenPortalView: React.FC<{
  mode: 'overview' | 'report' | 'complaints' | 'alerts';
}> = ({ mode }) => {
  const {
    currentUser,
    zones,
    zoneAssessments,
    incidents,
    alerts,
    scenario,
    citizenMapDraft,
    setCitizenMapDraft,
    submitCitizenIncident,
    setActiveNav,
  } = useAquaGuard();

  const [selectedWardLookup, setSelectedWardLookup] = useState(zones[7].id);

  // Report Form State
  const [title, setTitle] = useState('');
  const [wardId, setWardId] = useState(citizenMapDraft?.wardId ?? 'ward-benz-circle');
  const [location, setLocation] = useState(citizenMapDraft?.suggestedLocation ?? '');
  const [severity, setSeverity] = useState<RiskLevel>(RiskLevel.HIGH);
  const [description, setDescription] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submittedBanner, setSubmittedBanner] = useState<string | null>(null);

  useEffect(() => {
    if (citizenMapDraft) {
      setWardId(citizenMapDraft.wardId);
      setLocation(citizenMapDraft.suggestedLocation);
    }
  }, [citizenMapDraft]);

  // Citizens must see ONLY their own submitted complaints (never other citizens' private details)
  const myIncidents = useMemo(
    () =>
      incidents.filter((inc) =>
        currentUser?.id ? inc.reporterId === currentUser.id : false
      ),
    [incidents, currentUser?.id]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateIncidentInput({ title, location, wardId, description });
    if (!check.valid) {
      setErrors(check.errors as Record<string, string>);
      return;
    }

    const created = submitCitizenIncident({
      title,
      location,
      wardId,
      description,
      severity,
      photoDataUrl,
      photoName,
      lat: citizenMapDraft?.lat,
      lng: citizenMapDraft?.lng,
    });

    setTitle('');
    setLocation('');
    setDescription('');
    setPhotoDataUrl(undefined);
    setPhotoName(undefined);
    setErrors({});
    setSubmittedBanner(
      `Report ${created.id} submitted for ${created.wardName}. Municipal authorities for this ward have been notified.`
    );
  };

  const lookupZone = zones.find((z) => z.id === selectedWardLookup) ?? zones[0];
  const lookupAssessment = zoneAssessments[lookupZone.id];

  if (mode === 'report') {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Report a Waterlogging Incident"
          subtitle="Submit street-level waterlogging, overflowing gutters, or underpass stagnation for municipal verification in your Vijayawada ward."
          dataTag="Direct Ward Routing · Public Submission Portal"
          action={
            <button
              type="button"
              onClick={() => setActiveNav('gis-map')}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#243758] bg-[#0F192D] px-3.5 py-2 text-xs font-medium text-teal-300 hover:border-teal-500/60 transition-colors whitespace-nowrap"
            >
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pick Location on Map</span>
            </button>
          }
        />

        {citizenMapDraft && (
          <div className="flex flex-col gap-2 rounded-lg border border-teal-500/40 bg-teal-500/10 p-3.5 text-xs text-teal-200 sm:flex-row sm:items-center sm:justify-between max-w-3xl">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-teal-400" aria-hidden="true" />
              <span>
                <strong>Pre-filled from GIS Map:</strong>{' '}
                {citizenMapDraft.suggestedLocation} (
                <span className="font-mono">
                  {citizenMapDraft.lat.toFixed(4)}, {citizenMapDraft.lng.toFixed(4)}
                </span>
                )
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCitizenMapDraft(null)}
              className="text-[11px] font-medium text-slate-300 hover:text-white self-start sm:self-auto"
            >
              Clear Pin
            </button>
          </div>
        )}

        {submittedBanner && (
          <div className="flex flex-col gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-200 sm:flex-row sm:items-center sm:justify-between max-w-3xl">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
              <span>{submittedBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setActiveNav('my-complaints')}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 whitespace-nowrap self-start"
            >
              Track My Complaints
            </button>
          </div>
        )}

        <form
          onSubmit={handleReportSubmit}
          className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-6 space-y-5 max-w-3xl"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="citizen-title"
                className="block text-xs font-medium text-slate-200"
              >
                Incident Title
              </label>
              <input
                id="citizen-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Knee-deep water near underpass"
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
              />
              {errors.title && (
                <p className="mt-1 text-xs text-rose-400">{errors.title}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="citizen-ward"
                className="block text-xs font-medium text-slate-200"
              >
                Vijayawada Ward / Locality
              </label>
              <select
                id="citizen-ward"
                value={wardId}
                onChange={(e) => setWardId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    Ward {z.wardNumber} — {z.name}
                  </option>
                ))}
              </select>
              {errors.wardId && (
                <p className="mt-1 text-xs text-rose-400">{errors.wardId}</p>
              )}
            </div>
          </div>

          <div>
            <label
              htmlFor="citizen-location"
              className="block text-xs font-medium text-slate-200"
            >
              Exact Street / Landmark
            </label>
            <input
              id="citizen-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Benz Circle Service Lane near NTR Health University"
              className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
            {errors.location && (
              <p className="mt-1 text-xs text-rose-400">{errors.location}</p>
            )}
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-200 mb-2">
              Waterlogging Severity
            </span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Object.values(RiskLevel).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setSeverity(lvl)}
                  className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                    severity === lvl
                      ? 'border-teal-500 bg-teal-500/20 text-teal-200'
                      : 'border-[#243758] bg-[#0B1424] text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="citizen-desc"
              className="block text-xs font-medium text-slate-200"
            >
              Description (Water Depth, Street Condition, Traffic Impact)
            </label>
            <textarea
              id="citizen-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe estimated water depth, blocked roadside grates, or stranded vehicles..."
              className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-500 focus:outline-none"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-rose-400">{errors.description}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="citizen-photo"
              className="block text-xs font-medium text-slate-200"
            >
              Incident Photograph (Optional File Upload)
            </label>
            <div className="mt-1.5 flex flex-col gap-3 rounded-md border border-dashed border-[#2B4269] bg-[#0B1424] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-teal-400 shrink-0" aria-hidden="true" />
                <div className="text-xs text-slate-300">
                  {photoName ? (
                    <span className="text-teal-300 font-medium">{photoName}</span>
                  ) : (
                    <span>Attach a photo of the waterlogged street</span>
                  )}
                </div>
              </div>
              <input
                id="citizen-photo"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="text-xs text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-teal-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-teal-500"
              />
            </div>
            {photoDataUrl && (
              <img
                src={photoDataUrl}
                alt="Preview of uploaded waterlogging incident"
                className="mt-3 h-40 w-full max-w-sm rounded-md border border-[#1E2F4D] object-cover"
              />
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-md bg-teal-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              <span>Submit Waterlogging Report</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (mode === 'complaints') {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="My Waterlogging Complaints"
          subtitle={`Track verification and municipal resolution status for reports submitted by ${currentUser?.name ?? 'you'}.`}
          dataTag={`Personal Citizen Ledger (${myIncidents.length} Submitted)`}
          action={
            <button
              type="button"
              onClick={() => setActiveNav('report-incident')}
              className="rounded-md bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500"
            >
              New Incident Report
            </button>
          }
        />

        {myIncidents.length === 0 ? (
          <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-8 text-center space-y-3">
            <div className="text-sm font-semibold text-slate-100">
              You have not submitted any waterlogging complaints yet
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Select a location on the Vijayawada Risk Map or open the reporting form to submit a street-level incident.
            </p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setActiveNav('gis-map')}
                className="rounded-md border border-[#243758] bg-[#0B1424] px-3.5 py-2 text-xs font-medium text-slate-200 hover:border-teal-500/60"
              >
                Pin Location on Map
              </button>
              <button
                type="button"
                onClick={() => setActiveNav('report-incident')}
                className="rounded-md bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-teal-500"
              >
                Report Incident
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {myIncidents.map((inc) => (
              <div
                key={inc.id}
                className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-4 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span className="font-mono text-teal-300">{inc.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{inc.wardName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{inc.createdAt}</span>
                    </div>
                    <h3 className="mt-1 text-sm font-semibold text-slate-100">
                      {inc.title}
                    </h3>
                    <div className="text-xs text-slate-400">{inc.location}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <RiskLabel level={inc.severity} />
                    <IncidentStatusBadge status={inc.status} />
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {inc.description}
                </p>

                {inc.photoDataUrl && (
                  <img
                    src={inc.photoDataUrl}
                    alt={`Uploaded photo for ${inc.title}`}
                    className="h-32 w-56 rounded-md border border-[#1E2F4D] object-cover"
                  />
                )}

                {inc.officerNotes && (
                  <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2 text-xs text-slate-300">
                    <span className="font-medium text-teal-300">Municipal Status Update: </span>
                    {inc.officerNotes}
                    <span className="ml-2 font-mono text-[11px] text-slate-500">
                      (Updated {inc.updatedAt})
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'alerts') {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Public Alerts & Monsoon Safety Updates"
          subtitle="Stay informed on active waterlogging advisories, underpass closures, and municipal helpline contacts in Vijayawada."
          dataTag="Sample Public Safety Advisories (Demo)"
        />

        <div className="grid gap-4 md:grid-cols-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono text-slate-400">
                  <Bell className="h-3.5 w-3.5 text-teal-400" aria-hidden="true" />
                  <span>{alert.issuedAt}</span>
                </span>
                <RiskLabel level={alert.severity} />
              </div>
              <h3 className="text-base font-semibold text-slate-100">
                {alert.title}
              </h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                {alert.summary}
              </p>
              <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 text-xs text-slate-200">
                <span className="font-semibold text-teal-300">Safety Action: </span>
                {alert.advisory}
              </div>
              <div className="text-[11px] text-slate-400">
                Affected Wards: {alert.affectedWards.join(' · ')}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <PhoneCall className="mt-0.5 h-5 w-5 text-teal-400 shrink-0" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-slate-100">
                Municipal Monsoon Helpline (Demo Contact Card)
              </div>
              <div className="text-xs text-slate-400">
                Vijayawada Flood &amp; Public Safety Control Room (Sample): 1800-425-0000 · Dial 112 for life-safety emergencies
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('report-incident')}
            className="rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500 whitespace-nowrap shrink-0"
          >
            Report Street Waterlogging
          </button>
        </div>
      </div>
    );
  }

  // Citizen Overview Mode
  const myOpenCount = myIncidents.filter(
    (i) => i.status !== IncidentStatus.RESOLVED
  ).length;
  const myResolvedCount = myIncidents.filter(
    (i) => i.status === IncidentStatus.RESOLVED
  ).length;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Citizen Waterlogging & Safety Portal"
        subtitle="Check local Vijayawada ward risk levels, pin street waterlogging on the public map, and track your submitted complaints."
        dataTag={`Public Safety View · Scenario: ${scenario} (Demo)`}
        action={
          <button
            type="button"
            onClick={() => setActiveNav('report-incident')}
            className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-500"
          >
            <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Report Waterlogging</span>
          </button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          label="Active City Advisories"
          value={alerts.length}
          detail="Sample monsoon safety notices"
          tone="amber"
        />
        <KpiCard
          label="My Open Complaints"
          value={myOpenCount}
          detail="Awaiting verification or action"
          tone="teal"
        />
        <KpiCard
          label="My Resolved Complaints"
          value={myResolvedCount}
          detail="Cleared by municipal response"
          tone="emerald"
        />
      </div>

      {/* Local Ward Risk Lookup */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-6 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-100">
              Check Local Ward Risk Information
            </h3>
            <MapPin className="h-4 w-4 text-teal-400" aria-hidden="true" />
          </div>

          <div>
            <label
              htmlFor="citizen-ward-lookup"
              className="block text-xs font-medium text-slate-300"
            >
              Select Your Neighbourhood / Ward
            </label>
            <select
              id="citizen-ward-lookup"
              value={selectedWardLookup}
              onChange={(e) => setSelectedWardLookup(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-[#243758] bg-[#0B1424] px-3 py-2 text-xs text-slate-100 focus:border-teal-500 focus:outline-none"
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  Ward {z.wardNumber} — {z.name} ({z.landmark})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  {lookupZone.name}
                </div>
                <div className="text-xs text-slate-400">{lookupZone.landmark}</div>
              </div>
              <RiskLabel
                level={lookupAssessment.category}
                score={lookupAssessment.score}
              />
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {lookupAssessment.recommendedAction}
            </p>
            <div className="text-[11px] text-slate-400">
              Public Safety Guidance: Use elevated alternate routes during intense rain and report submerged lanes via the Risk Map.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveNav('gis-map')}
            className="w-full rounded-md border border-[#243758] bg-[#0B1424] px-4 py-2 text-xs font-medium text-slate-200 hover:border-teal-500/60"
          >
            Select Location on Vijayawada Risk Map
          </button>
        </div>

        {/* Recent Advisories & My Complaint Updates */}
        <div className="lg:col-span-6 rounded-lg border border-[#1E2F4D] bg-[#0F192D] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">
              Latest Public Alerts &amp; My Reports
            </h3>
            <button
              type="button"
              onClick={() => setActiveNav('public-alerts')}
              className="text-xs font-medium text-teal-400 hover:text-teal-300"
            >
              View All Alerts
            </button>
          </div>

          <div className="space-y-2.5">
            {alerts.slice(0, 2).map((alert) => (
              <div
                key={alert.id}
                className="rounded-md border border-[#1E2F4D] bg-[#0B1424] p-3 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-100">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-hidden="true" />
                    <span>{alert.title}</span>
                  </span>
                  <RiskLabel level={alert.severity} />
                </div>
                <p className="text-xs text-slate-300">{alert.advisory}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-[#1E2F4D] pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300">
                My Submitted Reports
              </span>
              <button
                type="button"
                onClick={() => setActiveNav('my-complaints')}
                className="text-teal-400 hover:text-teal-300"
              >
                Track Mine ({myIncidents.length})
              </button>
            </div>
            {myIncidents.length === 0 ? (
              <div className="rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2.5 text-xs text-slate-400">
                No personal complaints submitted yet.
              </div>
            ) : (
              myIncidents.slice(0, 2).map((inc) => (
                <div
                  key={inc.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-[#1E2F4D] bg-[#0B1424] px-3 py-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium text-slate-100">
                      {inc.title}
                    </div>
                    <div className="truncate text-[11px] text-slate-400">
                      {inc.wardName}
                    </div>
                  </div>
                  <IncidentStatusBadge status={inc.status} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
