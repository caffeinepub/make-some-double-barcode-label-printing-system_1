import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Time "mo:core/Time";

module {
  type PrefixMapping = {
    labelType : Text;
    title : Text;
  };

  type LayoutSettings = {
    x : Int;
    y : Int;
    scale : Float;
    width : Int;
    height : Int;
    fontSize : Nat;
    verticalSpacing : Nat;
  };

  type BarcodePosition = {
    x : Int;
    y : Int;
    verticalSpacing : Nat;
  };

  type PrintJob = {
    id : Nat;
    timestamp : Time.Time;
    prefix : Text;
    leftSerial : Text;
    rightSerial : Text;
    labelType : Text;
    printCount : Nat;
    owner : ?Principal;
  };

  type UserProfile = {
    name : Text;
  };

  type OldLabelSettings = {
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
    barcode1Position : BarcodePosition;
    barcode2Position : BarcodePosition;
    globalVerticalOffset : Nat;
    globalHorizontalOffset : Nat;
  };

  type OldActor = {
    printHistory : Map.Map<Nat, PrintJob>;
    userProfiles : Map.Map<Principal, UserProfile>;
    currentId : Nat;
    usedSerials : Map.Map<Text, Bool>;
    labelSettings : Map.Map<Principal, OldLabelSettings>;
  };

  type NewLabelSettings = {
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
    barcode1Position : BarcodePosition;
    barcode2Position : BarcodePosition;
    globalVerticalOffset : Nat;
    globalHorizontalOffset : Nat;
  };

  type NewActor = {
    printHistory : Map.Map<Nat, PrintJob>;
    userProfiles : Map.Map<Principal, UserProfile>;
    currentId : Nat;
    usedSerials : Map.Map<Text, Bool>;
    labelSettings : Map.Map<Principal, NewLabelSettings>;
  };

  public func run(old : OldActor) : NewActor {
    let newLabelSettings = old.labelSettings.map<Principal, OldLabelSettings, NewLabelSettings>(
      func(_p, oldSettings) {
        { oldSettings with widthMm = 58; heightMm = 43 };
      }
    );
    { old with labelSettings = newLabelSettings };
  };
};
