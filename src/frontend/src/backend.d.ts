import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export type Time = bigint;
export interface LabelSettings {
    barcode2Layout: LayoutSettings;
    widthMm: bigint;
    heightMm: bigint;
    serialText1Layout: LayoutSettings;
    serialText2Layout: LayoutSettings;
    spacing: bigint;
    barcodeType: string;
    prefixMappings: Array<[string, PrefixMapping]>;
    barcodeHeight: bigint;
    barcode1Layout: LayoutSettings;
    titleLayout: LayoutSettings;
}
export interface LayoutSettings {
    x: bigint;
    y: bigint;
    height: bigint;
    scale: number;
    width: bigint;
    fontSize: bigint;
}
export interface PrefixMapping {
    title: string;
    labelType: string;
}
export interface PrintJob {
    id: bigint;
    owner?: Principal;
    labelType: string;
    leftSerial: string;
    printCount: bigint;
    timestamp: Time;
    prefix: string;
    rightSerial: string;
}
export interface UserProfile {
    name: string;
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getLabelSettings(): Promise<LabelSettings>;
    getPrintHistory(): Promise<Array<PrintJob>>;
    getPrintHistoryByLabelType(): Promise<Array<PrintJob>>;
    getPrintHistoryByTimestamp(): Promise<Array<PrintJob>>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    increasePrintCount(jobId: bigint): Promise<void>;
    isCallerAdmin(): Promise<boolean>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    submitPrintJob(prefix: string, leftSerial: string, rightSerial: string): Promise<boolean>;
    updateLabelSettings(newSettings: LabelSettings): Promise<void>;
}
