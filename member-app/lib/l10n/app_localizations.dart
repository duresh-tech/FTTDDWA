import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_en.dart';
import 'app_localizations_ta.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of L
/// returned by `L.of(context)`.
///
/// Applications need to include `L.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: L.localizationsDelegates,
///   supportedLocales: L.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the L.supportedLocales
/// property.
abstract class L {
  L(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static L of(BuildContext context) {
    return Localizations.of<L>(context, L)!;
  }

  static const LocalizationsDelegate<L> delegate = _LDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('en'),
    Locale('ta'),
  ];

  /// This language, written in itself, for the language picker.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageName;

  /// No description provided for @languageChoose.
  ///
  /// In en, this message translates to:
  /// **'Choose your language'**
  String get languageChoose;

  /// No description provided for @languageSubtitle.
  ///
  /// In en, this message translates to:
  /// **'You can change this later.'**
  String get languageSubtitle;

  /// No description provided for @languageEnglish.
  ///
  /// In en, this message translates to:
  /// **'English'**
  String get languageEnglish;

  /// Always Tamil script, in both locales: somebody who cannot read English has to recognise it.
  ///
  /// In en, this message translates to:
  /// **'தமிழ்'**
  String get languageTamil;

  /// No description provided for @languageContinue.
  ///
  /// In en, this message translates to:
  /// **'Continue'**
  String get languageContinue;

  /// No description provided for @languageLabel.
  ///
  /// In en, this message translates to:
  /// **'Language'**
  String get languageLabel;

  /// No description provided for @appFallbackName.
  ///
  /// In en, this message translates to:
  /// **'Membership'**
  String get appFallbackName;

  /// No description provided for @configProblem.
  ///
  /// In en, this message translates to:
  /// **'Configuration problem'**
  String get configProblem;

  /// No description provided for @tryAgain.
  ///
  /// In en, this message translates to:
  /// **'Try again'**
  String get tryAgain;

  /// No description provided for @cancel.
  ///
  /// In en, this message translates to:
  /// **'Cancel'**
  String get cancel;

  /// No description provided for @back.
  ///
  /// In en, this message translates to:
  /// **'Back'**
  String get back;

  /// No description provided for @next.
  ///
  /// In en, this message translates to:
  /// **'Next'**
  String get next;

  /// No description provided for @close.
  ///
  /// In en, this message translates to:
  /// **'Close'**
  String get close;

  /// No description provided for @signIn.
  ///
  /// In en, this message translates to:
  /// **'Sign in'**
  String get signIn;

  /// No description provided for @signOut.
  ///
  /// In en, this message translates to:
  /// **'Sign out'**
  String get signOut;

  /// No description provided for @membershipNumber.
  ///
  /// In en, this message translates to:
  /// **'Membership number'**
  String get membershipNumber;

  /// No description provided for @membershipNumberHelper.
  ///
  /// In en, this message translates to:
  /// **'Printed on your membership card'**
  String get membershipNumberHelper;

  /// No description provided for @membershipNumberRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your membership number'**
  String get membershipNumberRequired;

  /// No description provided for @password.
  ///
  /// In en, this message translates to:
  /// **'Password'**
  String get password;

  /// No description provided for @passwordRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your password'**
  String get passwordRequired;

  /// No description provided for @applyForMembership.
  ///
  /// In en, this message translates to:
  /// **'Apply for membership'**
  String get applyForMembership;

  /// No description provided for @registerClosed.
  ///
  /// In en, this message translates to:
  /// **'This association is not accepting new applications at the moment.'**
  String get registerClosed;

  /// No description provided for @siteUnreachable.
  ///
  /// In en, this message translates to:
  /// **'Could not reach the association, so applying is unavailable. Signing in may still work.'**
  String get siteUnreachable;

  /// No description provided for @noPasswordYet.
  ///
  /// In en, this message translates to:
  /// **'No password yet? Your association sets one up for you.'**
  String get noPasswordYet;

  /// No description provided for @stepIdentity.
  ///
  /// In en, this message translates to:
  /// **'Identity'**
  String get stepIdentity;

  /// No description provided for @stepContact.
  ///
  /// In en, this message translates to:
  /// **'Contact & sign-in'**
  String get stepContact;

  /// No description provided for @stepAssociation.
  ///
  /// In en, this message translates to:
  /// **'Association'**
  String get stepAssociation;

  /// No description provided for @stepLocation.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get stepLocation;

  /// No description provided for @stepIdentityShort.
  ///
  /// In en, this message translates to:
  /// **'Identity'**
  String get stepIdentityShort;

  /// No description provided for @stepContactShort.
  ///
  /// In en, this message translates to:
  /// **'Contact'**
  String get stepContactShort;

  /// No description provided for @stepAssociationShort.
  ///
  /// In en, this message translates to:
  /// **'Association'**
  String get stepAssociationShort;

  /// No description provided for @stepLocationShort.
  ///
  /// In en, this message translates to:
  /// **'Location'**
  String get stepLocationShort;

  /// No description provided for @stepIdentityBlurb.
  ///
  /// In en, this message translates to:
  /// **'Your name, date of birth and photo.'**
  String get stepIdentityBlurb;

  /// No description provided for @stepContactBlurb.
  ///
  /// In en, this message translates to:
  /// **'How the association reaches you, and the password you will sign in with.'**
  String get stepContactBlurb;

  /// No description provided for @stepAssociationBlurb.
  ///
  /// In en, this message translates to:
  /// **'What you do, and the position you are applying for.'**
  String get stepAssociationBlurb;

  /// No description provided for @stepLocationBlurb.
  ///
  /// In en, this message translates to:
  /// **'Where your business is, for your district association.'**
  String get stepLocationBlurb;

  /// No description provided for @submitApplication.
  ///
  /// In en, this message translates to:
  /// **'Submit application'**
  String get submitApplication;

  /// No description provided for @discardTitle.
  ///
  /// In en, this message translates to:
  /// **'Discard this application?'**
  String get discardTitle;

  /// No description provided for @discardBody.
  ///
  /// In en, this message translates to:
  /// **'What you have filled in will not be kept.'**
  String get discardBody;

  /// No description provided for @discardKeep.
  ///
  /// In en, this message translates to:
  /// **'Keep filling it in'**
  String get discardKeep;

  /// No description provided for @discardConfirm.
  ///
  /// In en, this message translates to:
  /// **'Discard'**
  String get discardConfirm;

  /// No description provided for @yourName.
  ///
  /// In en, this message translates to:
  /// **'Your name'**
  String get yourName;

  /// No description provided for @yourNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your name'**
  String get yourNameRequired;

  /// No description provided for @yourNameTamil.
  ///
  /// In en, this message translates to:
  /// **'Your name in Tamil'**
  String get yourNameTamil;

  /// No description provided for @businessName.
  ///
  /// In en, this message translates to:
  /// **'Business name'**
  String get businessName;

  /// No description provided for @businessNameRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter your business name'**
  String get businessNameRequired;

  /// No description provided for @businessNameTamil.
  ///
  /// In en, this message translates to:
  /// **'Business name in Tamil'**
  String get businessNameTamil;

  /// No description provided for @dateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get dateOfBirth;

  /// No description provided for @married.
  ///
  /// In en, this message translates to:
  /// **'Married'**
  String get married;

  /// No description provided for @weddingDate.
  ///
  /// In en, this message translates to:
  /// **'Wedding date'**
  String get weddingDate;

  /// No description provided for @aadhaarOptional.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar number (optional)'**
  String get aadhaarOptional;

  /// No description provided for @aadhaarHint.
  ///
  /// In en, this message translates to:
  /// **'1234 5678 9012'**
  String get aadhaarHint;

  /// No description provided for @aadhaarHelper.
  ///
  /// In en, this message translates to:
  /// **'Stored encrypted. Only the last four digits are ever shown.'**
  String get aadhaarHelper;

  /// No description provided for @yourPhoto.
  ///
  /// In en, this message translates to:
  /// **'Your photo'**
  String get yourPhoto;

  /// No description provided for @photoHelper.
  ///
  /// In en, this message translates to:
  /// **'Optional. Printed on your membership card.'**
  String get photoHelper;

  /// No description provided for @photoCamera.
  ///
  /// In en, this message translates to:
  /// **'Camera'**
  String get photoCamera;

  /// No description provided for @photoGallery.
  ///
  /// In en, this message translates to:
  /// **'Gallery'**
  String get photoGallery;

  /// No description provided for @photoAttached.
  ///
  /// In en, this message translates to:
  /// **'Photo attached'**
  String get photoAttached;

  /// No description provided for @photoTooLarge.
  ///
  /// In en, this message translates to:
  /// **'That photo is too large. Try another.'**
  String get photoTooLarge;

  /// No description provided for @photoUnreadable.
  ///
  /// In en, this message translates to:
  /// **'Could not open the photo.'**
  String get photoUnreadable;

  /// No description provided for @phoneNumber.
  ///
  /// In en, this message translates to:
  /// **'Phone number'**
  String get phoneNumber;

  /// No description provided for @phoneRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter a phone number'**
  String get phoneRequired;

  /// No description provided for @phoneTooShort.
  ///
  /// In en, this message translates to:
  /// **'That looks too short'**
  String get phoneTooShort;

  /// No description provided for @whatsappNumber.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp number'**
  String get whatsappNumber;

  /// No description provided for @whatsappHelper.
  ///
  /// In en, this message translates to:
  /// **'Leave blank if it is the same as your phone number'**
  String get whatsappHelper;

  /// No description provided for @email.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get email;

  /// No description provided for @emailRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an email address'**
  String get emailRequired;

  /// No description provided for @emailInvalid.
  ///
  /// In en, this message translates to:
  /// **'Enter a valid email address'**
  String get emailInvalid;

  /// No description provided for @addressLine1.
  ///
  /// In en, this message translates to:
  /// **'Address line 1'**
  String get addressLine1;

  /// No description provided for @addressRequired.
  ///
  /// In en, this message translates to:
  /// **'Enter an address'**
  String get addressRequired;

  /// No description provided for @addressLine2.
  ///
  /// In en, this message translates to:
  /// **'Address line 2'**
  String get addressLine2;

  /// No description provided for @signingInHeading.
  ///
  /// In en, this message translates to:
  /// **'Signing in'**
  String get signingInHeading;

  /// No description provided for @signingInBlurb.
  ///
  /// In en, this message translates to:
  /// **'Once your application is approved you will sign in with your membership number and this password.'**
  String get signingInBlurb;

  /// No description provided for @passwordHelper.
  ///
  /// In en, this message translates to:
  /// **'At least 8 characters'**
  String get passwordHelper;

  /// No description provided for @passwordTooShort.
  ///
  /// In en, this message translates to:
  /// **'Use at least 8 characters'**
  String get passwordTooShort;

  /// No description provided for @confirmPassword.
  ///
  /// In en, this message translates to:
  /// **'Confirm password'**
  String get confirmPassword;

  /// No description provided for @passwordsDoNotMatch.
  ///
  /// In en, this message translates to:
  /// **'The passwords do not match'**
  String get passwordsDoNotMatch;

  /// No description provided for @position.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get position;

  /// No description provided for @positionFixedNote.
  ///
  /// In en, this message translates to:
  /// **'Set by the association for everyone applying.'**
  String get positionFixedNote;

  /// No description provided for @noPositions.
  ///
  /// In en, this message translates to:
  /// **'This association has no positions set up yet'**
  String get noPositions;

  /// No description provided for @trade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get trade;

  /// No description provided for @noTrades.
  ///
  /// In en, this message translates to:
  /// **'This association has no trades set up yet'**
  String get noTrades;

  /// No description provided for @chooseAPosition.
  ///
  /// In en, this message translates to:
  /// **'Choose a position'**
  String get chooseAPosition;

  /// No description provided for @chooseATrade.
  ///
  /// In en, this message translates to:
  /// **'Choose a trade'**
  String get chooseATrade;

  /// No description provided for @state.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get state;

  /// No description provided for @noStates.
  ///
  /// In en, this message translates to:
  /// **'This association has no states set up yet'**
  String get noStates;

  /// No description provided for @district.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get district;

  /// No description provided for @chooseStateFirst.
  ///
  /// In en, this message translates to:
  /// **'Choose a state first'**
  String get chooseStateFirst;

  /// No description provided for @noDistrictsInState.
  ///
  /// In en, this message translates to:
  /// **'No districts in that state'**
  String get noDistrictsInState;

  /// No description provided for @taluk.
  ///
  /// In en, this message translates to:
  /// **'Taluk'**
  String get taluk;

  /// No description provided for @chooseDistrictFirst.
  ///
  /// In en, this message translates to:
  /// **'Choose a district first'**
  String get chooseDistrictFirst;

  /// No description provided for @noTaluksInDistrict.
  ///
  /// In en, this message translates to:
  /// **'No taluks in that district'**
  String get noTaluksInDistrict;

  /// No description provided for @rto.
  ///
  /// In en, this message translates to:
  /// **'RTO'**
  String get rto;

  /// No description provided for @noRtosInDistrict.
  ///
  /// In en, this message translates to:
  /// **'No RTOs in that district'**
  String get noRtosInDistrict;

  /// No description provided for @rtoNote.
  ///
  /// In en, this message translates to:
  /// **'Your membership number is issued from this RTO, so it cannot be changed later.'**
  String get rtoNote;

  /// No description provided for @chooseAState.
  ///
  /// In en, this message translates to:
  /// **'Choose a state'**
  String get chooseAState;

  /// No description provided for @chooseADistrict.
  ///
  /// In en, this message translates to:
  /// **'Choose a district'**
  String get chooseADistrict;

  /// No description provided for @chooseATaluk.
  ///
  /// In en, this message translates to:
  /// **'Choose a taluk'**
  String get chooseATaluk;

  /// No description provided for @chooseAnRto.
  ///
  /// In en, this message translates to:
  /// **'Choose an RTO'**
  String get chooseAnRto;

  /// No description provided for @selectHint.
  ///
  /// In en, this message translates to:
  /// **'Select'**
  String get selectHint;

  /// No description provided for @nothingAvailable.
  ///
  /// In en, this message translates to:
  /// **'Nothing available'**
  String get nothingAvailable;

  /// No description provided for @applicationReceived.
  ///
  /// In en, this message translates to:
  /// **'Application received'**
  String get applicationReceived;

  /// No description provided for @yourApplicationNumber.
  ///
  /// In en, this message translates to:
  /// **'Your application number'**
  String get yourApplicationNumber;

  /// No description provided for @keepThisNumber.
  ///
  /// In en, this message translates to:
  /// **'Keep this number. {association} will review your application, and you will be able to sign in once it is approved.'**
  String keepThisNumber(String association);

  /// No description provided for @theAssociation.
  ///
  /// In en, this message translates to:
  /// **'The association'**
  String get theAssociation;

  /// No description provided for @numberIssuedOnApproval.
  ///
  /// In en, this message translates to:
  /// **'Your membership number is issued on approval, not now.'**
  String get numberIssuedOnApproval;

  /// No description provided for @backToSignIn.
  ///
  /// In en, this message translates to:
  /// **'Back to sign in'**
  String get backToSignIn;

  /// No description provided for @questionsContact.
  ///
  /// In en, this message translates to:
  /// **'Questions? {contacts}'**
  String questionsContact(String contacts);

  /// No description provided for @yourMembership.
  ///
  /// In en, this message translates to:
  /// **'Your membership'**
  String get yourMembership;

  /// No description provided for @yourDetails.
  ///
  /// In en, this message translates to:
  /// **'Your details'**
  String get yourDetails;

  /// No description provided for @fieldName.
  ///
  /// In en, this message translates to:
  /// **'Name'**
  String get fieldName;

  /// No description provided for @fieldBusiness.
  ///
  /// In en, this message translates to:
  /// **'Business'**
  String get fieldBusiness;

  /// No description provided for @fieldPosition.
  ///
  /// In en, this message translates to:
  /// **'Position'**
  String get fieldPosition;

  /// No description provided for @fieldTrade.
  ///
  /// In en, this message translates to:
  /// **'Trade'**
  String get fieldTrade;

  /// No description provided for @fieldPhone.
  ///
  /// In en, this message translates to:
  /// **'Phone'**
  String get fieldPhone;

  /// No description provided for @fieldWhatsapp.
  ///
  /// In en, this message translates to:
  /// **'WhatsApp'**
  String get fieldWhatsapp;

  /// No description provided for @fieldEmail.
  ///
  /// In en, this message translates to:
  /// **'Email'**
  String get fieldEmail;

  /// No description provided for @fieldDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Date of birth'**
  String get fieldDateOfBirth;

  /// No description provided for @fieldWeddingDate.
  ///
  /// In en, this message translates to:
  /// **'Wedding date'**
  String get fieldWeddingDate;

  /// No description provided for @fieldAadhaar.
  ///
  /// In en, this message translates to:
  /// **'Aadhaar'**
  String get fieldAadhaar;

  /// No description provided for @fieldAddress.
  ///
  /// In en, this message translates to:
  /// **'Address'**
  String get fieldAddress;

  /// No description provided for @fieldTaluk.
  ///
  /// In en, this message translates to:
  /// **'Taluk'**
  String get fieldTaluk;

  /// No description provided for @fieldDistrict.
  ///
  /// In en, this message translates to:
  /// **'District'**
  String get fieldDistrict;

  /// No description provided for @fieldState.
  ///
  /// In en, this message translates to:
  /// **'State'**
  String get fieldState;

  /// No description provided for @fieldRto.
  ///
  /// In en, this message translates to:
  /// **'RTO'**
  String get fieldRto;

  /// No description provided for @cannotEditHere.
  ///
  /// In en, this message translates to:
  /// **'Something wrong? Contact your association — members cannot edit their own record here.'**
  String get cannotEditHere;

  /// No description provided for @membershipCard.
  ///
  /// In en, this message translates to:
  /// **'Membership card'**
  String get membershipCard;

  /// No description provided for @cardValid.
  ///
  /// In en, this message translates to:
  /// **'Valid'**
  String get cardValid;

  /// No description provided for @cardExpired.
  ///
  /// In en, this message translates to:
  /// **'Expired'**
  String get cardExpired;

  /// No description provided for @cardChecking.
  ///
  /// In en, this message translates to:
  /// **'Checking…'**
  String get cardChecking;

  /// No description provided for @cardNoneIssued.
  ///
  /// In en, this message translates to:
  /// **'None issued yet. Your association issues these — ask them if you need one.'**
  String get cardNoneIssued;

  /// No description provided for @cardIssueNumber.
  ///
  /// In en, this message translates to:
  /// **'Issue {number}'**
  String cardIssueNumber(int number);

  /// No description provided for @cardNoExpiry.
  ///
  /// In en, this message translates to:
  /// **'No expiry'**
  String get cardNoExpiry;

  /// No description provided for @cardExpiredOn.
  ///
  /// In en, this message translates to:
  /// **'Expired {date}'**
  String cardExpiredOn(String date);

  /// No description provided for @cardValidUntil.
  ///
  /// In en, this message translates to:
  /// **'Valid until {date}'**
  String cardValidUntil(String date);

  /// No description provided for @cardDownload.
  ///
  /// In en, this message translates to:
  /// **'Download'**
  String get cardDownload;

  /// No description provided for @cardExpiredNotice.
  ///
  /// In en, this message translates to:
  /// **'This card has expired. Contact your association for a new one.'**
  String get cardExpiredNotice;

  /// No description provided for @cardSavedTo.
  ///
  /// In en, this message translates to:
  /// **'Saved to {path}'**
  String cardSavedTo(String path);

  /// No description provided for @errorNetwork.
  ///
  /// In en, this message translates to:
  /// **'Could not reach the server. Check your connection.'**
  String get errorNetwork;

  /// No description provided for @validationTamilOnly.
  ///
  /// In en, this message translates to:
  /// **'{field} must be in Tamil, not English letters'**
  String validationTamilOnly(String field);

  /// No description provided for @fieldYourTamilName.
  ///
  /// In en, this message translates to:
  /// **'Your Tamil name'**
  String get fieldYourTamilName;

  /// No description provided for @fieldTamilBusinessName.
  ///
  /// In en, this message translates to:
  /// **'The Tamil business name'**
  String get fieldTamilBusinessName;

  /// No description provided for @validationChooseDateOfBirth.
  ///
  /// In en, this message translates to:
  /// **'Choose a date of birth'**
  String get validationChooseDateOfBirth;

  /// No description provided for @validationDateOfBirthUnreal.
  ///
  /// In en, this message translates to:
  /// **'That date of birth is not a real date'**
  String get validationDateOfBirthUnreal;

  /// No description provided for @validationTooYoung.
  ///
  /// In en, this message translates to:
  /// **'You must be at least {years} years old to apply'**
  String validationTooYoung(int years);

  /// No description provided for @validationChooseWeddingDate.
  ///
  /// In en, this message translates to:
  /// **'Choose a wedding date'**
  String get validationChooseWeddingDate;

  /// No description provided for @validationWeddingDateUnreal.
  ///
  /// In en, this message translates to:
  /// **'That wedding date is not a real date'**
  String get validationWeddingDateUnreal;

  /// No description provided for @validationWeddingInFuture.
  ///
  /// In en, this message translates to:
  /// **'A wedding date cannot be in the future'**
  String get validationWeddingInFuture;

  /// No description provided for @validationWeddingBeforeBirth.
  ///
  /// In en, this message translates to:
  /// **'A wedding date cannot be before your date of birth'**
  String get validationWeddingBeforeBirth;

  /// No description provided for @validationAadhaarDigits.
  ///
  /// In en, this message translates to:
  /// **'An Aadhaar number has 12 digits (you entered {count})'**
  String validationAadhaarDigits(int count);
}

class _LDelegate extends LocalizationsDelegate<L> {
  const _LDelegate();

  @override
  Future<L> load(Locale locale) {
    return SynchronousFuture<L>(lookupL(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['en', 'ta'].contains(locale.languageCode);

  @override
  bool shouldReload(_LDelegate old) => false;
}

L lookupL(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'en':
      return LEn();
    case 'ta':
      return LTa();
  }

  throw FlutterError(
    'L.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
