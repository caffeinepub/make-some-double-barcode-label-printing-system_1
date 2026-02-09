import Map "mo:core/Map";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Order "mo:core/Order";
import Text "mo:core/Text";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Int "mo:core/Int";

import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  public type PrefixMapping = {
    labelType : Text;
    title : Text;
  };

  public type LayoutSettings = {
    x : Int; // X position (mm)
    y : Int; // Y position (mm)
    scale : Float; // Element scale in percent (0.0 - 1.0)
    width : Int;
    height : Int;
    fontSize : Nat;
  };

  public type LabelSettings = {
    widthMm : Nat;
    heightMm : Nat;
    barcodeType : Text;
    barcodeHeight : Nat;
    spacing : Nat;
    prefixMappings : [(Text, PrefixMapping)];
    titleLayout : LayoutSettings;
    barcode1Layout : LayoutSettings;
    serialText1Layout : LayoutSettings;
    barcode2Layout : LayoutSettings;
    serialText2Layout : LayoutSettings;
  };

  public type PrintJob = {
    id : Nat;
    timestamp : Time.Time;
    prefix : Text;
    leftSerial : Text;
    rightSerial : Text;
    labelType : Text;
    printCount : Nat;
    owner : ?Principal;
  };

  public type UserProfile = {
    name : Text;
  };

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let printHistory = Map.empty<Nat, PrintJob>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  let usedSerials = Map.empty<Text, Bool>();
  var currentId = 0;

  let labelSettings = Map.empty<Principal, LabelSettings>();

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func submitPrintJob(prefix : Text, leftSerial : Text, rightSerial : Text) : async Bool {
    // Authorization removed

    if (usedSerials.get(leftSerial) == ?true) {
      Runtime.trap("Duplicate serial: leftSerial already used");
    };
    if (usedSerials.get(rightSerial) == ?true) {
      Runtime.trap("Duplicate serial: rightSerial already used");
    };

    let defaultLayout : LayoutSettings = {
      x = 0;
      y = 0;
      scale = 1.0;
      width = 0;
      height = 0;
      fontSize = 12;
    };

    let defaultSettings : LabelSettings = {
      widthMm = 50;
      heightMm = 25;
      barcodeType = "CODE128";
      barcodeHeight = 10;
      spacing = 5;
      prefixMappings = [];
      titleLayout = defaultLayout;
      barcode1Layout = defaultLayout;
      serialText1Layout = defaultLayout;
      barcode2Layout = defaultLayout;
      serialText2Layout = defaultLayout;
    };

    let userSettings = switch (labelSettings.get(caller)) {
      case (null) { defaultSettings };
      case (?settings) { settings };
    };

    let mappings = Map.fromArray<Text, PrefixMapping>(userSettings.prefixMappings);
    let mapping = mappings.get(prefix);
    switch (mapping) {
      case (null) { Runtime.trap("Unknown prefix") };
      case (?prefixMapping) {
        let newJob : PrintJob = {
          id = currentId;
          timestamp = Time.now();
          prefix;
          leftSerial;
          rightSerial;
          labelType = prefixMapping.labelType;
          printCount = 1;
          owner = ?caller;
        };
        printHistory.add(currentId, newJob);
        usedSerials.add(leftSerial, true);
        usedSerials.add(rightSerial, true);
        currentId += 1;
        true;
      };
    };
  };

  public query ({ caller }) func getLabelSettings() : async LabelSettings {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view label settings");
    };

    switch (labelSettings.get(caller)) {
      case (null) {
        let defaultLayout : LayoutSettings = {
          x = 0;
          y = 0;
          scale = 1.0;
          width = 0;
          height = 0;
          fontSize = 12;
        };
        {
          widthMm = 50;
          heightMm = 25;
          barcodeType = "CODE128";
          barcodeHeight = 10;
          spacing = 5;
          prefixMappings = [];
          titleLayout = defaultLayout;
          barcode1Layout = defaultLayout;
          serialText1Layout = defaultLayout;
          barcode2Layout = defaultLayout;
          serialText2Layout = defaultLayout;
        };
      };
      case (?settings) { settings };
    };
  };

  public shared ({ caller }) func updateLabelSettings(newSettings : LabelSettings) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can update label settings");
    };
    labelSettings.add(caller, newSettings);
  };

  public query ({ caller }) func getPrintHistory() : async [PrintJob] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view print history");
    };
    let allJobs = printHistory.values().toArray();
    let isAdmin = AccessControl.isAdmin(accessControlState, caller);
    if (isAdmin) {
      allJobs;
    } else {
      allJobs.filter(func(job : PrintJob) : Bool { job.owner == ?caller });
    };
  };

  public query ({ caller }) func getPrintHistoryByLabelType() : async [PrintJob] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view print history");
    };
    let allJobs = printHistory.values().toArray();
    let isAdmin = AccessControl.isAdmin(accessControlState, caller);
    let filteredJobs = if (isAdmin) {
      allJobs;
    } else {
      allJobs.filter(func(job : PrintJob) : Bool { job.owner == ?caller });
    };
    filteredJobs.sort(PrintJob.compareByLabelType);
  };

  public query ({ caller }) func getPrintHistoryByTimestamp() : async [PrintJob] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can view print history");
    };
    let allJobs = printHistory.values().toArray();
    let isAdmin = AccessControl.isAdmin(accessControlState, caller);
    let filteredJobs = if (isAdmin) {
      allJobs;
    } else {
      allJobs.filter(func(job : PrintJob) : Bool { job.owner == ?caller });
    };
    filteredJobs.sort();
  };

  module PrintJob {
    public func compare(a : PrintJob, b : PrintJob) : Order.Order {
      Int.compare(b.timestamp, a.timestamp);
    };

    public func compareByLabelType(a : PrintJob, b : PrintJob) : Order.Order {
      switch (Text.compare(a.labelType, b.labelType)) {
        case (#equal) { Int.compare(b.timestamp, a.timestamp) };
        case (order) { order };
      };
    };
  };

  public shared ({ caller }) func increasePrintCount(jobId : Nat) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can increase print count");
    };
    switch (printHistory.get(jobId)) {
      case (null) { Runtime.trap("Print job not found") };
      case (?job) {
        if (job.owner != ?caller and not AccessControl.isAdmin(accessControlState, caller)) {
          Runtime.trap("Unauthorized: Can only modify your own print jobs");
        };
        let updatedJob = {
          id = job.id;
          timestamp = job.timestamp;
          prefix = job.prefix;
          leftSerial = job.leftSerial;
          rightSerial = job.rightSerial;
          labelType = job.labelType;
          printCount = job.printCount + 1;
          owner = job.owner;
        };
        printHistory.add(jobId, updatedJob);
      };
    };
  };
};

