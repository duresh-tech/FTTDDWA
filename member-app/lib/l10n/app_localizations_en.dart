// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class LEn extends L {
  LEn([String locale = 'en']) : super(locale);

  @override
  String get languageName => 'English';

  @override
  String get languageChoose => 'Choose your language';

  @override
  String get languageSubtitle => 'You can change this later.';

  @override
  String get languageEnglish => 'English';

  @override
  String get languageTamil => 'தமிழ்';

  @override
  String get languageContinue => 'Continue';

  @override
  String get languageLabel => 'Language';

  @override
  String get appFallbackName => 'Membership';

  @override
  String get configProblem => 'Configuration problem';

  @override
  String get tryAgain => 'Try again';

  @override
  String get cancel => 'Cancel';

  @override
  String get back => 'Back';

  @override
  String get next => 'Next';

  @override
  String get close => 'Close';

  @override
  String get signIn => 'Sign in';

  @override
  String get signOut => 'Sign out';

  @override
  String get membershipNumber => 'Membership number';

  @override
  String get membershipNumberHelper => 'Printed on your membership card';

  @override
  String get membershipNumberRequired => 'Enter your membership number';

  @override
  String get password => 'Password';

  @override
  String get passwordRequired => 'Enter your password';

  @override
  String get applyForMembership => 'Apply for membership';

  @override
  String get registerClosed =>
      'This association is not accepting new applications at the moment.';

  @override
  String get siteUnreachable =>
      'Could not reach the association, so applying is unavailable. Signing in may still work.';

  @override
  String get noPasswordYet =>
      'No password yet? Your association sets one up for you.';

  @override
  String get stepIdentity => 'Identity';

  @override
  String get stepContact => 'Contact & sign-in';

  @override
  String get stepAssociation => 'Association';

  @override
  String get stepLocation => 'Location';

  @override
  String get stepIdentityShort => 'Identity';

  @override
  String get stepContactShort => 'Contact';

  @override
  String get stepAssociationShort => 'Association';

  @override
  String get stepLocationShort => 'Location';

  @override
  String get stepIdentityBlurb => 'Your name, date of birth and photo.';

  @override
  String get stepContactBlurb =>
      'How the association reaches you, and the password you will sign in with.';

  @override
  String get stepAssociationBlurb =>
      'What you do, and the position you are applying for.';

  @override
  String get stepLocationBlurb =>
      'Where your business is, for your district association.';

  @override
  String get submitApplication => 'Submit application';

  @override
  String get discardTitle => 'Discard this application?';

  @override
  String get discardBody => 'What you have filled in will not be kept.';

  @override
  String get discardKeep => 'Keep filling it in';

  @override
  String get discardConfirm => 'Discard';

  @override
  String get yourName => 'Your name';

  @override
  String get yourNameRequired => 'Enter your name';

  @override
  String get yourNameTamil => 'Your name in Tamil';

  @override
  String get businessName => 'Business name';

  @override
  String get businessNameRequired => 'Enter your business name';

  @override
  String get businessNameTamil => 'Business name in Tamil';

  @override
  String get dateOfBirth => 'Date of birth';

  @override
  String get married => 'Married';

  @override
  String get weddingDate => 'Wedding date';

  @override
  String get aadhaarOptional => 'Aadhaar number (optional)';

  @override
  String get aadhaarHint => '1234 5678 9012';

  @override
  String get aadhaarHelper =>
      'Stored encrypted. Only the last four digits are ever shown.';

  @override
  String get yourPhoto => 'Your photo';

  @override
  String get photoHelper => 'Optional. Printed on your membership card.';

  @override
  String get photoCamera => 'Camera';

  @override
  String get photoGallery => 'Gallery';

  @override
  String get photoAttached => 'Photo attached';

  @override
  String get photoTooLarge => 'That photo is too large. Try another.';

  @override
  String get photoUnreadable => 'Could not open the photo.';

  @override
  String get phoneNumber => 'Phone number';

  @override
  String get phoneRequired => 'Enter a phone number';

  @override
  String get phoneTooShort => 'That looks too short';

  @override
  String get whatsappNumber => 'WhatsApp number';

  @override
  String get whatsappHelper =>
      'Leave blank if it is the same as your phone number';

  @override
  String get email => 'Email';

  @override
  String get emailRequired => 'Enter an email address';

  @override
  String get emailInvalid => 'Enter a valid email address';

  @override
  String get addressLine1 => 'Address line 1';

  @override
  String get addressRequired => 'Enter an address';

  @override
  String get addressLine2 => 'Address line 2';

  @override
  String get signingInHeading => 'Signing in';

  @override
  String get signingInBlurb =>
      'Once your application is approved you will sign in with your membership number and this password.';

  @override
  String get passwordHelper => 'At least 8 characters';

  @override
  String get passwordTooShort => 'Use at least 8 characters';

  @override
  String get confirmPassword => 'Confirm password';

  @override
  String get passwordsDoNotMatch => 'The passwords do not match';

  @override
  String get position => 'Position';

  @override
  String get positionFixedNote =>
      'Set by the association for everyone applying.';

  @override
  String get noPositions => 'This association has no positions set up yet';

  @override
  String get trade => 'Trade';

  @override
  String get noTrades => 'This association has no trades set up yet';

  @override
  String get chooseAPosition => 'Choose a position';

  @override
  String get chooseATrade => 'Choose a trade';

  @override
  String get state => 'State';

  @override
  String get noStates => 'This association has no states set up yet';

  @override
  String get district => 'District';

  @override
  String get chooseStateFirst => 'Choose a state first';

  @override
  String get noDistrictsInState => 'No districts in that state';

  @override
  String get taluk => 'Taluk';

  @override
  String get chooseDistrictFirst => 'Choose a district first';

  @override
  String get noTaluksInDistrict => 'No taluks in that district';

  @override
  String get rto => 'RTO';

  @override
  String get noRtosInDistrict => 'No RTOs in that district';

  @override
  String get rtoNote =>
      'Your membership number is issued from this RTO, so it cannot be changed later.';

  @override
  String get chooseAState => 'Choose a state';

  @override
  String get chooseADistrict => 'Choose a district';

  @override
  String get chooseATaluk => 'Choose a taluk';

  @override
  String get chooseAnRto => 'Choose an RTO';

  @override
  String get selectHint => 'Select';

  @override
  String get nothingAvailable => 'Nothing available';

  @override
  String get applicationReceived => 'Application received';

  @override
  String get yourApplicationNumber => 'Your application number';

  @override
  String keepThisNumber(String association) {
    return 'Keep this number. $association will review your application, and you will be able to sign in once it is approved.';
  }

  @override
  String get theAssociation => 'The association';

  @override
  String get numberIssuedOnApproval =>
      'Your membership number is issued on approval, not now.';

  @override
  String get backToSignIn => 'Back to sign in';

  @override
  String questionsContact(String contacts) {
    return 'Questions? $contacts';
  }

  @override
  String get yourMembership => 'Your membership';

  @override
  String get yourDetails => 'Your details';

  @override
  String get fieldName => 'Name';

  @override
  String get fieldBusiness => 'Business';

  @override
  String get fieldPosition => 'Position';

  @override
  String get fieldTrade => 'Trade';

  @override
  String get fieldPhone => 'Phone';

  @override
  String get fieldWhatsapp => 'WhatsApp';

  @override
  String get fieldEmail => 'Email';

  @override
  String get fieldDateOfBirth => 'Date of birth';

  @override
  String get fieldWeddingDate => 'Wedding date';

  @override
  String get fieldAadhaar => 'Aadhaar';

  @override
  String get fieldAddress => 'Address';

  @override
  String get fieldTaluk => 'Taluk';

  @override
  String get fieldDistrict => 'District';

  @override
  String get fieldState => 'State';

  @override
  String get fieldRto => 'RTO';

  @override
  String get cannotEditHere =>
      'Something wrong? Contact your association — members cannot edit their own record here.';

  @override
  String get membershipCard => 'Membership card';

  @override
  String get cardValid => 'Valid';

  @override
  String get cardExpired => 'Expired';

  @override
  String get cardChecking => 'Checking…';

  @override
  String get cardNoneIssued =>
      'None issued yet. Your association issues these — ask them if you need one.';

  @override
  String cardIssueNumber(int number) {
    return 'Issue $number';
  }

  @override
  String get cardNoExpiry => 'No expiry';

  @override
  String cardExpiredOn(String date) {
    return 'Expired $date';
  }

  @override
  String cardValidUntil(String date) {
    return 'Valid until $date';
  }

  @override
  String get cardDownload => 'Download';

  @override
  String get cardExpiredNotice =>
      'This card has expired. Contact your association for a new one.';

  @override
  String cardSavedTo(String path) {
    return 'Saved to $path';
  }

  @override
  String get errorNetwork =>
      'Could not reach the server. Check your connection.';

  @override
  String validationTamilOnly(String field) {
    return '$field must be in Tamil, not English letters';
  }

  @override
  String get fieldYourTamilName => 'Your Tamil name';

  @override
  String get fieldTamilBusinessName => 'The Tamil business name';

  @override
  String get validationChooseDateOfBirth => 'Choose a date of birth';

  @override
  String get validationDateOfBirthUnreal =>
      'That date of birth is not a real date';

  @override
  String validationTooYoung(int years) {
    return 'You must be at least $years years old to apply';
  }

  @override
  String get validationChooseWeddingDate => 'Choose a wedding date';

  @override
  String get validationWeddingDateUnreal =>
      'That wedding date is not a real date';

  @override
  String get validationWeddingInFuture =>
      'A wedding date cannot be in the future';

  @override
  String get validationWeddingBeforeBirth =>
      'A wedding date cannot be before your date of birth';

  @override
  String validationAadhaarDigits(int count) {
    return 'An Aadhaar number has 12 digits (you entered $count)';
  }
}
