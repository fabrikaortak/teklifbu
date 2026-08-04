"use client";

import { CITY_NAMES, getDistricts } from "@/data/turkey-locations";
import {
  COMMERCIAL_FIELD_LABELS,
  COMPANY_TYPE_OPTIONS,
  nextDemoCommercialBundle,
  nextDemoCommercialProfile,
  type CommercialProfile,
} from "@/data/commercialProfile";
import type { CommercialSubtype } from "@/lib/accountTypes";

type Props = {
  value: CommercialProfile;
  onChange: (next: CommercialProfile) => void;
  /** Demo doldurunca faaliyet alanlarını da güncelle (kayıt formu) */
  onDemoFill?: (next: { profile: CommercialProfile; subtypes: CommercialSubtype[] }) => void;
  demoFillEnabled?: boolean;
  disabled?: boolean;
  compact?: boolean;
  /** Yatay 2 sütun düzeni (kayıt adım 2) */
  wide?: boolean;
  hideIntro?: boolean;
};

export function CommercialBusinessForm({
  value,
  onChange,
  onDemoFill,
  demoFillEnabled = false,
  disabled = false,
  compact = false,
  wide = false,
  hideIntro = false,
}: Props) {
  const districts = value.businessCity ? getDistricts(value.businessCity) : [];
  const gap = compact || wide ? 8 : 10;

  function set<K extends keyof CommercialProfile>(key: K, v: string) {
    onChange({ ...value, [key]: v });
  }

  function fillDemo() {
    if (onDemoFill) {
      onDemoFill(nextDemoCommercialBundle());
      return;
    }
    onChange(nextDemoCommercialProfile());
  }

  const label = (text: string, required?: boolean) => (
    <span style={{ fontSize: 12.5, fontWeight: 700 }}>
      {text}
      {required ? " *" : ""}
    </span>
  );

  if (wide) {
    return (
      <div style={{ display: "grid", gap }}>
        {!hideIntro ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>İşletme bilgileri</div>
            <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
              Zorunlu alanlar (*) işaretlidir.
            </p>
          </>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap }}>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.commercialTitle, true)}
            <input
              className="input"
              disabled={disabled}
              value={value.commercialTitle}
              onChange={(e) => set("commercialTitle", e.target.value)}
              placeholder="Örn. Anadolu Emlak Ltd. Şti."
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.companyType, true)}
            <select
              className="select"
              disabled={disabled}
              value={value.companyType}
              onChange={(e) => set("companyType", e.target.value)}
            >
              <option value="">Seçiniz</option>
              {COMPANY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap }}>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.taxNumber, true)}
            <input
              className="input"
              disabled={disabled}
              inputMode="numeric"
              value={value.taxNumber}
              onChange={(e) => set("taxNumber", e.target.value.replace(/\D/g, "").slice(0, 11))}
              placeholder="10–11 hane"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.taxOffice, true)}
            <input
              className="input"
              disabled={disabled}
              value={value.taxOffice}
              onChange={(e) => set("taxOffice", e.target.value)}
              placeholder="Örn. Kadıköy"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.tradeRegistryNo)}
            <input
              className="input"
              disabled={disabled}
              value={value.tradeRegistryNo}
              onChange={(e) => set("tradeRegistryNo", e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.mersisNo)}
            <input
              className="input"
              disabled={disabled}
              value={value.mersisNo}
              onChange={(e) => set("mersisNo", e.target.value.replace(/\D/g, "").slice(0, 16))}
              placeholder="16 hane"
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.yetkiBelgeNo)}
          <input
            className="input"
            disabled={disabled}
            value={value.yetkiBelgeNo}
            onChange={(e) => set("yetkiBelgeNo", e.target.value)}
            placeholder="Örn. YB-2024-1001"
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap }}>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.businessCity, true)}
            <select
              className="select"
              disabled={disabled}
              value={value.businessCity}
              onChange={(e) => onChange({ ...value, businessCity: e.target.value, businessDistrict: "" })}
            >
              <option value="">İl seçin</option>
              {CITY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.businessDistrict)}
            <select
              className="select"
              disabled={disabled || !value.businessCity}
              value={value.businessDistrict}
              onChange={(e) => set("businessDistrict", e.target.value)}
            >
              <option value="">İlçe seçin</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.businessAddress, true)}
            <input
              className="input"
              disabled={disabled}
              value={value.businessAddress}
              onChange={(e) => set("businessAddress", e.target.value)}
              placeholder="Mahalle, cadde, no"
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap }}>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.authorizedTitle, true)}
            <input
              className="input"
              disabled={disabled}
              value={value.authorizedTitle}
              onChange={(e) => set("authorizedTitle", e.target.value)}
              placeholder="Örn. Şirket Müdürü"
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.authorizedPhone)}
            <input
              className="input"
              disabled={disabled}
              value={value.authorizedPhone}
              onChange={(e) => set("authorizedPhone", e.target.value)}
            />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            {label(COMMERCIAL_FIELD_LABELS.naceCode)}
            <input
              className="input"
              disabled={disabled}
              value={value.naceCode}
              onChange={(e) => set("naceCode", e.target.value)}
              placeholder="Örn. 68.31"
            />
          </label>
        </div>

        {demoFillEnabled && !disabled ? (
          <button
            type="button"
            className="btn-outline"
            style={{ padding: 10, fontSize: 13, fontWeight: 700, justifySelf: "start" }}
            onClick={fillDemo}
          >
            Demo doldur (rastgele işletme)
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap }}>
      {!hideIntro ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a" }}>İşletme bilgileri</div>
          <p style={{ margin: 0, fontSize: 12.5, color: "#64748b", lineHeight: 1.45 }}>
            Ticari unvan, vergi ve işyeri bilgileri yönetici onayında kullanılır. Zorunlu alanlar (*)
            işaretlidir.
          </p>
        </>
      ) : null}

      <label style={{ display: "grid", gap: 4 }}>
        {label(COMMERCIAL_FIELD_LABELS.commercialTitle, true)}
        <input
          className="input"
          disabled={disabled}
          value={value.commercialTitle}
          onChange={(e) => set("commercialTitle", e.target.value)}
          placeholder="Örn. Anadolu Emlak Ltd. Şti."
        />
      </label>

      <label style={{ display: "grid", gap: 4 }}>
        {label(COMMERCIAL_FIELD_LABELS.companyType, true)}
        <select
          className="select"
          disabled={disabled}
          value={value.companyType}
          onChange={(e) => set("companyType", e.target.value)}
        >
          <option value="">Seçiniz</option>
          {COMPANY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.taxNumber, true)}
          <input
            className="input"
            disabled={disabled}
            inputMode="numeric"
            value={value.taxNumber}
            onChange={(e) => set("taxNumber", e.target.value.replace(/\D/g, "").slice(0, 11))}
            placeholder="10 veya 11 hane"
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.taxOffice, true)}
          <input
            className="input"
            disabled={disabled}
            value={value.taxOffice}
            onChange={(e) => set("taxOffice", e.target.value)}
            placeholder="Örn. Kadıköy"
          />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.tradeRegistryNo)}
          <input
            className="input"
            disabled={disabled}
            value={value.tradeRegistryNo}
            onChange={(e) => set("tradeRegistryNo", e.target.value)}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.mersisNo)}
          <input
            className="input"
            disabled={disabled}
            value={value.mersisNo}
            onChange={(e) => set("mersisNo", e.target.value.replace(/\D/g, "").slice(0, 16))}
            placeholder="16 hane"
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        {label(COMMERCIAL_FIELD_LABELS.yetkiBelgeNo)}
        <input
          className="input"
          disabled={disabled}
          value={value.yetkiBelgeNo}
          onChange={(e) => set("yetkiBelgeNo", e.target.value)}
          placeholder="Örn. YB-2024-1001"
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.businessCity, true)}
          <select
            className="select"
            disabled={disabled}
            value={value.businessCity}
            onChange={(e) => onChange({ ...value, businessCity: e.target.value, businessDistrict: "" })}
          >
            <option value="">İl seçin</option>
            {CITY_NAMES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.businessDistrict)}
          <select
            className="select"
            disabled={disabled || !value.businessCity}
            value={value.businessDistrict}
            onChange={(e) => set("businessDistrict", e.target.value)}
          >
            <option value="">İlçe seçin</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        {label(COMMERCIAL_FIELD_LABELS.businessAddress, true)}
        <textarea
          className="input"
          disabled={disabled}
          rows={2}
          value={value.businessAddress}
          onChange={(e) => set("businessAddress", e.target.value)}
          style={{ resize: "vertical", fontFamily: "inherit" }}
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.authorizedTitle, true)}
          <input
            className="input"
            disabled={disabled}
            value={value.authorizedTitle}
            onChange={(e) => set("authorizedTitle", e.target.value)}
            placeholder="Örn. Şirket Müdürü"
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          {label(COMMERCIAL_FIELD_LABELS.authorizedPhone)}
          <input
            className="input"
            disabled={disabled}
            value={value.authorizedPhone}
            onChange={(e) => set("authorizedPhone", e.target.value)}
          />
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        {label(COMMERCIAL_FIELD_LABELS.naceCode)}
        <input
          className="input"
          disabled={disabled}
          value={value.naceCode}
          onChange={(e) => set("naceCode", e.target.value)}
          placeholder="Örn. 68.31"
        />
      </label>

      {demoFillEnabled && !disabled ? (
        <button
          type="button"
          className="btn-outline"
          style={{ padding: 10, fontSize: 13, fontWeight: 700 }}
          onClick={fillDemo}
        >
          Demo doldur (rastgele işletme)
        </button>
      ) : null}
    </div>
  );
}
