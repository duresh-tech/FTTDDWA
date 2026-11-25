/**
 * Tamil Nadu reference data for the seed-geography script.
 *
 * Districts (38) and taluks (298), including Tamil names, are extracted
 * from the `tndb2021.db` dataset in canabady2026/tn-local-admin-explorer
 * (https://github.com/canabady2026/tn-local-admin-explorer), 2021 local
 * administration data. RTO offices (65) come from kishorek/India-Codes
 * (https://github.com/kishorek/India-Codes/blob/master/csv/RTO.csv); the
 * special TN/N and TN/G series are not district RTOs and are omitted.
 * RTO-to-district assignment maps each office town to its 2021 district.
 *
 * These are reference rows, not authoritative legal records. Review them
 * against current government data before using them in production.
 */

export interface GeographyTalukSeed {
  talukName: string;
  talukNameTamil: string;
}

export interface GeographyRtoSeed {
  /** District code from this file, resolved to an id on insert. */
  districtCode: string;
  rtoCode: string;
  rtoName: string;
}

export interface GeographyDistrictSeed {
  districtCode: string;
  districtName: string;
  districtNameTamil: string;
  taluks: GeographyTalukSeed[];
  rtos: GeographyRtoSeed[];
}

export interface GeographySeed {
  country: { countryName: string; countryNameTamil: string; countryCode: string };
  state: {
    stateName: string;
    stateNameTamil: string;
    stateCode: string;
  };
  districts: GeographyDistrictSeed[];
}

export const TAMIL_NADU_GEOGRAPHY: GeographySeed = {
  country: { countryName: 'India', countryNameTamil: 'இந்தியா', countryCode: 'IN' },
  state: { stateName: 'Tamil Nadu', stateNameTamil: 'தமிழ்நாடு', stateCode: 'TN' },
  districts: [
    {
      districtCode: "TVL",
      districtName: "Thiruvallur",
      districtNameTamil: "திருவள்ளுர்",
      taluks: [
        { talukName: "Gummidipoondi", talukNameTamil: "கும்மிடிப்பூண்டி" },
        { talukName: "Pallipet", talukNameTamil: "பள்ளிப்பட்டு" },
        { talukName: "Ponneri", talukNameTamil: "பொன்னேரி" },
        { talukName: "Poonamallee", talukNameTamil: "புந்தமல்லி" },
        { talukName: "Tiruttani", talukNameTamil: "திருத்தணி" },
        { talukName: "Tiruvallur", talukNameTamil: "திருவள்ளுர" },
        { talukName: "Uthukottai", talukNameTamil: "ஊத்துக்கோட்டை" },
        { talukName: "Avadi", talukNameTamil: "ஆவடி" },
        { talukName: "R.K. Pettai", talukNameTamil: "ஆர்.கே. பேட்டை" },
      ],
      rtos: [
        { districtCode: "TVL", rtoCode: "TN18", rtoName: "Sengundram" },
        { districtCode: "TVL", rtoCode: "TN20", rtoName: "Tiruvallur" },
      ],
    },
    {
      districtCode: "MAA",
      districtName: "Chennai",
      districtNameTamil: "சென்னை",
      taluks: [
        { talukName: "Sholinganallur", talukNameTamil: "சோளிங்கநல்லூர்" },
        { talukName: "Alandur", talukNameTamil: "ஆலந்தூர்" },
        { talukName: "Maduravoyal", talukNameTamil: "மதுரவாயல்" },
        { talukName: "Madhavaram", talukNameTamil: "மாதவரம்" },
        { talukName: "Thiruvottiyur", talukNameTamil: "திருவொற்றியூர்" },
      ],
      rtos: [
        { districtCode: "MAA", rtoCode: "TN01", rtoName: "Chennai Central (Ayanavaram)" },
        { districtCode: "MAA", rtoCode: "TN02", rtoName: "Chennai West (Anna Nagar)" },
        { districtCode: "MAA", rtoCode: "TN03", rtoName: "Chennai North East (Tondiarpet)" },
        { districtCode: "MAA", rtoCode: "TN04", rtoName: "Chennai East (Basin Bridge)" },
        { districtCode: "MAA", rtoCode: "TN05", rtoName: "Chennai North (Vyasarpadi)" },
        { districtCode: "MAA", rtoCode: "TN06", rtoName: "Chennai South East (Mandaveli)" },
        { districtCode: "MAA", rtoCode: "TN07", rtoName: "Chennai South (Thiruvanmiyur)" },
        { districtCode: "MAA", rtoCode: "TN09", rtoName: "Chennai West (K.K. Nagar)" },
        { districtCode: "MAA", rtoCode: "TN10", rtoName: "Chennai South West (Valasarawakkam)" },
        { districtCode: "MAA", rtoCode: "TN22", rtoName: "Meenambakkam" },
      ],
    },
    {
      districtCode: "KCH",
      districtName: "Kancheepuram",
      districtNameTamil: "காஞ்சிபுரம்",
      taluks: [
        { talukName: "Kancheepuram", talukNameTamil: "காஞ்சிபுரம்" },
        { talukName: "Sriperumbudur", talukNameTamil: "திருப்பெரும்புதூர்" },
        { talukName: "Uthiramerur", talukNameTamil: "உத்திரமேரூர்" },
        { talukName: "Walajabad", talukNameTamil: "வாலாஜாபாத்" },
        { talukName: "Kundrathur", talukNameTamil: "குன்றத்தூர்" },
      ],
      rtos: [
        { districtCode: "KCH", rtoCode: "TN21", rtoName: "Kanchipuram" },
      ],
    },
    {
      districtCode: "VLR",
      districtName: "Vellore",
      districtNameTamil: "வேலூர்",
      taluks: [
        { talukName: "Vellore", talukNameTamil: "வேலூர்" },
        { talukName: "Gudiyatham", talukNameTamil: "குடியாத்தம்" },
        { talukName: "Katpadi", talukNameTamil: "காட்பாடி" },
        { talukName: "Anaicut", talukNameTamil: "அணைக்கட்டு" },
        { talukName: "Pernampattu", talukNameTamil: "பேரணாம்பட்டு" },
        { talukName: "K V Kuppam", talukNameTamil: "கே வி குப்பம்" },
      ],
      rtos: [
        { districtCode: "VLR", rtoCode: "TN23", rtoName: "Vellore" },
      ],
    },
    {
      districtCode: "DHP",
      districtName: "Dharmapuri",
      districtNameTamil: "தர்மபுரி",
      taluks: [
        { talukName: "Dharmapuri", talukNameTamil: "தருமபுரி" },
        { talukName: "Harur", talukNameTamil: "அரூர்" },
        { talukName: "Pennagaram", talukNameTamil: "பென்னாகரம்" },
        { talukName: "Pappireddipatty", talukNameTamil: "பாப்பிரெட்டிப்பட்டி" },
        { talukName: "Palacode", talukNameTamil: "பாலக்கோடு" },
        { talukName: "Karimangalam", talukNameTamil: "காரிமங்கலம்" },
        { talukName: "Nallampalli", talukNameTamil: "நல்லம்பள்ளி" },
      ],
      rtos: [
        { districtCode: "DHP", rtoCode: "TN29", rtoName: "Dharmapuri" },
      ],
    },
    {
      districtCode: "TRNM",
      districtName: "Tiruvannamalai",
      districtNameTamil: "திருவண்ணாமலை",
      taluks: [
        { talukName: "Tiruvannamalai", talukNameTamil: "திருவண்ணாமலை" },
        { talukName: "Polur", talukNameTamil: "போளுர்" },
        { talukName: "Chengam", talukNameTamil: "செங்கம்" },
        { talukName: "Cheyyar", talukNameTamil: "செய்யார்" },
        { talukName: "Arani", talukNameTamil: "ஆரணி" },
        { talukName: "Vandavasi", talukNameTamil: "வந்தவாசி" },
        { talukName: "Thandarampattu", talukNameTamil: "தண்டராம்பட்டு" },
        { talukName: "Kalasapakkam", talukNameTamil: "கலசபாக்கம்" },
        { talukName: "Chetpet", talukNameTamil: "சேத்துப்பட்டு" },
        { talukName: "Vembakkam", talukNameTamil: "வெம்பாக்கம்" },
        { talukName: "Kilpennathur", talukNameTamil: "கீழ்பென்னாத்தூர்" },
        { talukName: "Jamunamarathoor", talukNameTamil: "ஜமுனாமரத்தூர்" },
      ],
      rtos: [
        { districtCode: "TRNM", rtoCode: "TN25", rtoName: "Thiruvannamalai" },
      ],
    },
    {
      districtCode: "VPM",
      districtName: "Viluppuram",
      districtNameTamil: "விழுப்புரம்",
      taluks: [
        { talukName: "Villupuram", talukNameTamil: "விழுப்புரம்" },
        { talukName: "Vanur", talukNameTamil: "வானூா்" },
        { talukName: "Tindivanamm", talukNameTamil: "திண்டிவனம்" },
        { talukName: "Gingee", talukNameTamil: "செஞ்சி" },
        { talukName: "Vikravandi", talukNameTamil: "விக்கிரவாண்டி" },
        { talukName: "Marakkanam", talukNameTamil: "மரக்காணம்" },
        { talukName: "Kandachipuram", talukNameTamil: "கண்டாச்சிபுரம்" },
        { talukName: "Melmalayanur", talukNameTamil: "மேல்மலையனூர்" },
        { talukName: "Thiruvennainallur", talukNameTamil: "திருவெண்ணைநல்லூர்" },
      ],
      rtos: [
        { districtCode: "VPM", rtoCode: "TN16", rtoName: "Tindivanam" },
        { districtCode: "VPM", rtoCode: "TN32", rtoName: "Villupuram" },
      ],
    },
    {
      districtCode: "SLM",
      districtName: "Salem",
      districtNameTamil: "சேலம்",
      taluks: [
        { talukName: "Salem", talukNameTamil: "சேலம்" },
        { talukName: "Yercaud", talukNameTamil: "ஏற்காடு" },
        { talukName: "Gangavalli", talukNameTamil: "கெங்கவல்லி" },
        { talukName: "Attur", talukNameTamil: "ஆத்தூர்" },
        { talukName: "Valapady", talukNameTamil: "வாழப்பாடி" },
        { talukName: "Sankari", talukNameTamil: "சங்ககிரி" },
        { talukName: "Edappady", talukNameTamil: "எடப்பாடி" },
        { talukName: "Mettur", talukNameTamil: "மேட்டூர்" },
        { talukName: "Omalur", talukNameTamil: "ஓமலூர்" },
        { talukName: "Salem West", talukNameTamil: "சேலம் மேற்கு" },
        { talukName: "Salem South", talukNameTamil: "சேலம் தெற்கு" },
        { talukName: "Pethanaickenpalayam", talukNameTamil: "பெத்தநாயக்கன்பாளையம்" },
        { talukName: "Kadayampatti", talukNameTamil: "கடையாம்பட்டி" },
      ],
      rtos: [
        { districtCode: "SLM", rtoCode: "TN30", rtoName: "Salem (West)" },
        { districtCode: "SLM", rtoCode: "TN52", rtoName: "Sankagiri" },
        { districtCode: "SLM", rtoCode: "TN54", rtoName: "Salem (East)" },
        { districtCode: "SLM", rtoCode: "TN77", rtoName: "Attur" },
      ],
    },
    {
      districtCode: "NKL",
      districtName: "Namakkal",
      districtNameTamil: "நாமக்கல்",
      taluks: [
        { talukName: "Namakkal", talukNameTamil: "நாமக்கல்" },
        { talukName: "Rasipuram", talukNameTamil: "இராசிபுரம்" },
        { talukName: "Tiruchengode", talukNameTamil: "திருச்செங்கோடு" },
        { talukName: "Paramathivelur", talukNameTamil: "பரமத்தி வேலுார்" },
        { talukName: "Sendamangalam", talukNameTamil: "சேந்தமங்கலம்" },
        { talukName: "Kumarapalayam", talukNameTamil: "குமாரபாளையம்" },
        { talukName: "Mohanur", talukNameTamil: "மோகனூர்" },
      ],
      rtos: [
        { districtCode: "NKL", rtoCode: "TN28", rtoName: "Namakkal" },
        { districtCode: "NKL", rtoCode: "TN34", rtoName: "Thiruchengode" },
      ],
    },
    {
      districtCode: "ERO",
      districtName: "Erode",
      districtNameTamil: "ஈரோடு",
      taluks: [
        { talukName: "Erode", talukNameTamil: "ஈரோடு" },
        { talukName: "Perundurai", talukNameTamil: "பெருந்துறை" },
        { talukName: "Modakkurichi", talukNameTamil: "மொடக்குறிச்சி" },
        { talukName: "Kodumudi", talukNameTamil: "கொடுமுடி" },
        { talukName: "Gobichettipalayam", talukNameTamil: "கோபிசெட்டிபாளையம்" },
        { talukName: "Sathyamangalam", talukNameTamil: "சத்தியமங்கலம்" },
        { talukName: "Bhavani", talukNameTamil: "பவானி" },
        { talukName: "Anthiyur", talukNameTamil: "அந்தியூர்" },
        { talukName: "Thalavadi", talukNameTamil: "தாளவாடி" },
        { talukName: "Nambiyur", talukNameTamil: "நம்பியூர்" },
      ],
      rtos: [
        { districtCode: "ERO", rtoCode: "TN33", rtoName: "Erode" },
        { districtCode: "ERO", rtoCode: "TN36", rtoName: "Gobichettipalayam" },
        { districtCode: "ERO", rtoCode: "TN56", rtoName: "Perundurai" },
      ],
    },
    {
      districtCode: "NLG",
      districtName: "The Nilgiris",
      districtNameTamil: "உதகமண்டலம்",
      taluks: [
        { talukName: "Udhagai", talukNameTamil: "உதகை" },
        { talukName: "Coonoor", talukNameTamil: "குன்னூர்" },
        { talukName: "Kotagiri", talukNameTamil: "கோத்தகிர" },
        { talukName: "Gudalur", talukNameTamil: "கூடலூர்" },
        { talukName: "Kundah", talukNameTamil: "குந்தா" },
        { talukName: "Pandalur", talukNameTamil: "பந்தலூர்" },
      ],
      rtos: [
        { districtCode: "NLG", rtoCode: "TN43", rtoName: "Uthagamandalam" },
      ],
    },
    {
      districtCode: "CBE",
      districtName: "Coimbatore",
      districtNameTamil: "கோயம்புத்தூர்",
      taluks: [
        { talukName: "Coimbatore South", talukNameTamil: "கோயம்புத்தூர் தெற்கு" },
        { talukName: "Coimbatore North", talukNameTamil: "கோயம்புத்தூர் வடக்கு" },
        { talukName: "Pollachi", talukNameTamil: "பொள்ளாச்சி" },
        { talukName: "Mettupalayam", talukNameTamil: "மேட்டுப்பாளையம்" },
        { talukName: "Valparai", talukNameTamil: "வால்பாறை" },
        { talukName: "Sulur", talukNameTamil: "சூலூர்" },
        { talukName: "Annur", talukNameTamil: "அன்னூர்" },
        { talukName: "Kinathukkdavu", talukNameTamil: "கிணத்துக்கடவு" },
        { talukName: "Perur", talukNameTamil: "பேரூர்" },
        { talukName: "Madukkarai", talukNameTamil: "மதுக்கரை" },
        { talukName: "Anaimalai", talukNameTamil: "ஆனைமலை" },
      ],
      rtos: [
        { districtCode: "CBE", rtoCode: "TN37", rtoName: "Coimbatore (South)" },
        { districtCode: "CBE", rtoCode: "TN38", rtoName: "Coimbatore (North)" },
        { districtCode: "CBE", rtoCode: "TN40", rtoName: "Mettupalayam" },
        { districtCode: "CBE", rtoCode: "TN41", rtoName: "Pollachi" },
        { districtCode: "CBE", rtoCode: "TN66", rtoName: "Coimbatore (Central)" },
      ],
    },
    {
      districtCode: "DGL",
      districtName: "Dindigul",
      districtNameTamil: "திண்டுக்கல்",
      taluks: [
        { talukName: "Dindigul East", talukNameTamil: "திண்டுக்கல் கிழக்கு" },
        { talukName: "Nilakottai", talukNameTamil: "நிலக்கோட்டை" },
        { talukName: "Natham", talukNameTamil: "நத்தம்" },
        { talukName: "Athoor", talukNameTamil: "ஆத்தூர்" },
        { talukName: "Palani", talukNameTamil: "பழனி" },
        { talukName: "Oddenchatram", talukNameTamil: "ஒட்டன்சத்திரம்" },
        { talukName: "Vedasandur", talukNameTamil: "வேடசந்தூர்" },
        { talukName: "Gujiliamparai", talukNameTamil: "குஜிலியம்பாறை" },
        { talukName: "Kodaikannal", talukNameTamil: "கொடைக்கானல்" },
        { talukName: "Dindigul West", talukNameTamil: "திண்டுக்கல் (மேற்கு)" },
      ],
      rtos: [
        { districtCode: "DGL", rtoCode: "TN57", rtoName: "Dindigul" },
      ],
    },
    {
      districtCode: "KAR",
      districtName: "Karur",
      districtNameTamil: "கரூர்",
      taluks: [
        { talukName: "Karur", talukNameTamil: "கரூர்" },
        { talukName: "Arvakurichi", talukNameTamil: "அரவக்குறிச்சி" },
        { talukName: "Kulithalai", talukNameTamil: "குளித்தலை" },
        { talukName: "Krishnarayapuram", talukNameTamil: "கிருஷ்ணராயபுரம்" },
        { talukName: "Kadavur", talukNameTamil: "கடவூர்" },
        { talukName: "Manmangalam", talukNameTamil: "மண்மங்கலம்" },
        { talukName: "Pugalur", talukNameTamil: "புகளூர்" },
      ],
      rtos: [
        { districtCode: "KAR", rtoCode: "TN47", rtoName: "Karur" },
      ],
    },
    {
      districtCode: "TRY",
      districtName: "Tiruchirappalli",
      districtNameTamil: "திருச்சிராப்பள்ளி",
      taluks: [
        { talukName: "Lalgudi", talukNameTamil: "இலால்குடி" },
        { talukName: "Manapparai", talukNameTamil: "மணப்பாறை" },
        { talukName: "Musiri", talukNameTamil: "முசிறி" },
        { talukName: "Thuraiyur", talukNameTamil: "துறையூர்" },
        { talukName: "Manachanallur", talukNameTamil: "மண்ணச்சநல்லூர்" },
        { talukName: "Srirengam", talukNameTamil: "ஸ்ரீரங்கம்" },
        { talukName: "Thottiam", talukNameTamil: "தொட்டியம்" },
        { talukName: "Thiruverumbur", talukNameTamil: "திருவெறும்பூர்" },
        { talukName: "Marungapuri", talukNameTamil: "மருங்காபுரி" },
      ],
      rtos: [
        { districtCode: "TRY", rtoCode: "TN45", rtoName: "Tiruchirapalli" },
        { districtCode: "TRY", rtoCode: "TN48", rtoName: "Srirangam (Tiruchirapalli)" },
      ],
    },
    {
      districtCode: "PRB",
      districtName: "Perambalur",
      districtNameTamil: "பெரம்பலூர்",
      taluks: [
        { talukName: "Kunnam", talukNameTamil: "குன்னம்" },
        { talukName: "Perambalur", talukNameTamil: "பெரம்பலூர்" },
        { talukName: "Veppanthattai", talukNameTamil: "வேப்பந்தட்டை" },
        { talukName: "Alathur", talukNameTamil: "ஆலத்தூர்" },
      ],
      rtos: [
        { districtCode: "PRB", rtoCode: "TN46", rtoName: "Perambalur" },
      ],
    },
    {
      districtCode: "AYL",
      districtName: "Ariyalur",
      districtNameTamil: "அரியலூர்",
      taluks: [
        { talukName: "Ariyalur", talukNameTamil: "அரியலூர்" },
        { talukName: "Sendurai", talukNameTamil: "செந்துறை" },
        { talukName: "Udayarpalayam", talukNameTamil: "உடையார்பாளையம்" },
        { talukName: "Andimadam", talukNameTamil: "ஆண்டிமடம்" },
      ],
      rtos: [
        { districtCode: "AYL", rtoCode: "TN61", rtoName: "Ariyalur" },
      ],
    },
    {
      districtCode: "CUD",
      districtName: "Cuddalore",
      districtNameTamil: "கடலூர்",
      taluks: [
        { talukName: "Cuddalore", talukNameTamil: "கடலூர்" },
        { talukName: "Panruti", talukNameTamil: "பண்ருட்டி" },
        { talukName: "Chidambaram", talukNameTamil: "சிதம்பரம்" },
        { talukName: "Kattumannarkoil", talukNameTamil: "காட்டுமன்னாரகோயில்" },
        { talukName: "Vridhachalam", talukNameTamil: "விருத்தாசலம்" },
        { talukName: "Titagudi", talukNameTamil: "திட்டக்குடி" },
        { talukName: "Kurinjipadi", talukNameTamil: "குறிஞ்சிப்பாடி" },
        { talukName: "Veppur", talukNameTamil: "வேப்பூர்" },
        { talukName: "Bhuvanagiri", talukNameTamil: "புவனகிரி" },
        { talukName: "Srimushanam", talukNameTamil: "ஸ்ரீமுஷ்ணம்" },
      ],
      rtos: [
        { districtCode: "CUD", rtoCode: "TN31", rtoName: "Cuddalore" },
      ],
    },
    {
      districtCode: "NGP",
      districtName: "Nagapattinam",
      districtNameTamil: "நாகப்பட்டினம்",
      taluks: [
        { talukName: "Nagapattinam", talukNameTamil: "நாகப்பட்டினம்" },
        { talukName: "Kilvelur", talukNameTamil: "கீழ்வேளூர்" },
        { talukName: "Thirukkuvalai", talukNameTamil: "திருக்குவளை" },
        { talukName: "Vedaranyam", talukNameTamil: "வேதாரண்யம்" },
      ],
      rtos: [
        { districtCode: "NGP", rtoCode: "TN51", rtoName: "Nagapattinam" },
      ],
    },
    {
      districtCode: "TVR",
      districtName: "Thiruvarur",
      districtNameTamil: "திருவாரூர்",
      taluks: [
        { talukName: "Thiruvarur", talukNameTamil: "திருவாரூர்" },
        { talukName: "Nannilam", talukNameTamil: "நன்னிலம்" },
        { talukName: "Kudavasal", talukNameTamil: "குடவாசல்" },
        { talukName: "Valangaiman", talukNameTamil: "வலங்கைமான்" },
        { talukName: "Needamangalam", talukNameTamil: "நீடாமங்கலம்" },
        { talukName: "Mannargudi", talukNameTamil: "மன்னார்குடி" },
        { talukName: "Thiruthuraipoondi", talukNameTamil: "திருத்துறைப்பூண்டி" },
        { talukName: "Koothanallur", talukNameTamil: "கூத்தாநல்லூர்" },
      ],
      rtos: [
        { districtCode: "TVR", rtoCode: "TN50", rtoName: "Tiruvarur" },
      ],
    },
    {
      districtCode: "TJU",
      districtName: "Thanjavur",
      districtNameTamil: "தஞ்சாவூர்",
      taluks: [
        { talukName: "Thanjavur", talukNameTamil: "தஞ்சாவூர்" },
        { talukName: "Thiruvaiyaru", talukNameTamil: "திருவையாறு" },
        { talukName: "Orathanad", talukNameTamil: "ஒரத்தநாடு" },
        { talukName: "Thiruvidaimarudur", talukNameTamil: "திருவிடைமருதூர்" },
        { talukName: "Kumbakonam", talukNameTamil: "கும்பகோணம்" },
        { talukName: "Papanssam", talukNameTamil: "பாபநாசம்" },
        { talukName: "Pattukottai", talukNameTamil: "பட்டுக்கோட்டை" },
        { talukName: "Peravurani", talukNameTamil: "பேராவுரணி" },
        { talukName: "Budalur", talukNameTamil: "புதலூர்" },
      ],
      rtos: [
        { districtCode: "TJU", rtoCode: "TN49", rtoName: "Thanjavur" },
        { districtCode: "TJU", rtoCode: "TN68", rtoName: "Kumbakonam" },
      ],
    },
    {
      districtCode: "PDK",
      districtName: "Pudukkottai",
      districtNameTamil: "புதுக்கோட்டை",
      taluks: [
        { talukName: "Pudukkottai", talukNameTamil: "புதுக்கோட்டை" },
        { talukName: "Aranthangi", talukNameTamil: "அறந்தாங்கி" },
        { talukName: "Thirumayam", talukNameTamil: "திருமயம்" },
        { talukName: "Ponnamaravathi", talukNameTamil: "பொன்னமராவதி" },
        { talukName: "Manamelkudi", talukNameTamil: "மணமேல்குடி" },
        { talukName: "Kulathur", talukNameTamil: "குளத்தூர்" },
        { talukName: "Viralimalai", talukNameTamil: "விராலிமலை" },
        { talukName: "Gandarvakottai", talukNameTamil: "கந்தரவகோட்டை" },
        { talukName: "Illupur", talukNameTamil: "இலுப்பூர்" },
        { talukName: "Alangudi Taluk", talukNameTamil: "ஆலங்குடி" },
        { talukName: "Karambakudi Taluk", talukNameTamil: "கறம்பக்குடி" },
        { talukName: "Avudaiyarkoil", talukNameTamil: "ஆவுடையார்கோவில்" },
      ],
      rtos: [
        { districtCode: "PDK", rtoCode: "TN55", rtoName: "Pudukottai" },
      ],
    },
    {
      districtCode: "SVG",
      districtName: "Sivaganga",
      districtNameTamil: "சிவகங்கை",
      taluks: [
        { talukName: "Sivaganga", talukNameTamil: "சிவகங்கை" },
        { talukName: "Manamadurai", talukNameTamil: "மானாமதுரை" },
        { talukName: "Ilayankudi", talukNameTamil: "இளையான்குடி" },
        { talukName: "Thiruppuvanam", talukNameTamil: "திருப்புவனம்" },
        { talukName: "Kalaiyarkovil", talukNameTamil: "காளையார்கோவில்" },
        { talukName: "Devakottai", talukNameTamil: "தேவகோட்டை" },
        { talukName: "Karaikudi", talukNameTamil: "காரைக்குடி" },
        { talukName: "Thiruppattur", talukNameTamil: "திருப்பத்தூர்" },
        { talukName: "Singampunari", talukNameTamil: "சிங்கம்புணரி" },
      ],
      rtos: [
        { districtCode: "SVG", rtoCode: "TN63", rtoName: "Sivagangai" },
      ],
    },
    {
      districtCode: "MDU",
      districtName: "Madurai",
      districtNameTamil: "மதுரை",
      taluks: [
        { talukName: "Madurai North Taluk", talukNameTamil: "மதுரை வடக்கு" },
        { talukName: "Madurai South", talukNameTamil: "மதுரை தெற்கு" },
        { talukName: "Melur", talukNameTamil: "மேலூர்" },
        { talukName: "Vadipatti", talukNameTamil: "வாடிப்பட்டி" },
        { talukName: "Madurai East Taluk", talukNameTamil: "மதுரை கிழக்கு" },
        { talukName: "Madurai West", talukNameTamil: "மதுரை மேற்கு" },
        { talukName: "Thirupparankundram", talukNameTamil: "திருப்பரங்குன்றம்" },
        { talukName: "Usilampatti", talukNameTamil: "உசிலம்பட்டி" },
        { talukName: "Peraiyur", talukNameTamil: "பேரையூர்" },
        { talukName: "Tirumangalam", talukNameTamil: "திருமங்கலம்" },
        { talukName: "Kalligudi", talukNameTamil: "கள்ளிக்குடி" },
      ],
      rtos: [
        { districtCode: "MDU", rtoCode: "TN58", rtoName: "Madurai (South)" },
        { districtCode: "MDU", rtoCode: "TN59", rtoName: "Madurai (North)" },
        { districtCode: "MDU", rtoCode: "TN64", rtoName: "Madurai (Central)" },
      ],
    },
    {
      districtCode: "TNI",
      districtName: "Theni",
      districtNameTamil: "தேனி",
      taluks: [
        { talukName: "Theni", talukNameTamil: "தேனி" },
        { talukName: "Bodinayakkanur", talukNameTamil: "போடிநாயக்கனூர்" },
        { talukName: "Aundipatti", talukNameTamil: "ஆண்டிபட்டி" },
        { talukName: "Uthamapalayam", talukNameTamil: "உத்தமபாளையம்" },
        { talukName: "Periyakulam", talukNameTamil: "பெரியகுளம்" },
      ],
      rtos: [
        { districtCode: "TNI", rtoCode: "TN60", rtoName: "Theni" },
      ],
    },
    {
      districtCode: "VRN",
      districtName: "Virudhunagar",
      districtNameTamil: "விருதுநகர்",
      taluks: [
        { talukName: "Rajapalayam", talukNameTamil: "இராஜபாளையம்" },
        { talukName: "Srivilliputhur", talukNameTamil: "திருவில்லிபுத்துார" },
        { talukName: "Sattur", talukNameTamil: "சாத்தூர்" },
        { talukName: "Sivakasi", talukNameTamil: "சிவகாசி" },
        { talukName: "Virudhunagar", talukNameTamil: "விருதுநகர்" },
        { talukName: "Aruppukkottai", talukNameTamil: "அருப்புக்கோட்டை" },
        { talukName: "Tiruchuli", talukNameTamil: "திருச்சுழி" },
        { talukName: "Kariyapatti", talukNameTamil: "காரியாபட்டி" },
        { talukName: "Vembakottai", talukNameTamil: "வெம்பக்கோட்டை" },
        { talukName: "Watrap", talukNameTamil: "வத்திராயிருப்பு" },
      ],
      rtos: [
        { districtCode: "VRN", rtoCode: "TN67", rtoName: "Virudhunagar" },
      ],
    },
    {
      districtCode: "RMP",
      districtName: "Ramanathapuram",
      districtNameTamil: "ராமநாதபுரம்",
      taluks: [
        { talukName: "Ramanathapuram", talukNameTamil: "இராமநாதபுரம்" },
        { talukName: "Rameshwaram", talukNameTamil: "இராமேஸ்வரம்" },
        { talukName: "Thiruvadani", talukNameTamil: "திருவாடனை" },
        { talukName: "Kilakarai", talukNameTamil: "கீழக்கரை" },
        { talukName: "Rajasingamangalam", talukNameTamil: "இராஜசிங்கமங்கலம்" },
        { talukName: "Kadaladi", talukNameTamil: "கடலாடி" },
        { talukName: "Kamuthi", talukNameTamil: "கமுதி" },
        { talukName: "Mudukulathur", talukNameTamil: "முதுகுளத்தூர்" },
        { talukName: "Paramakudi", talukNameTamil: "பரமக்குடி" },
      ],
      rtos: [
        { districtCode: "RMP", rtoCode: "TN65", rtoName: "Ramanathapuram" },
      ],
    },
    {
      districtCode: "TUT",
      districtName: "Thoothukkudi",
      districtNameTamil: "தூத்துக்குடி",
      taluks: [
        { talukName: "Thoothukudi", talukNameTamil: "தூத்துக்குடி" },
        { talukName: "Tiruchendur", talukNameTamil: "திருச்செந்தூர்" },
        { talukName: "Ettayapuram", talukNameTamil: "எட்டயபுரம்" },
        { talukName: "Sattankulam", talukNameTamil: "சாத்தான்குளம்" },
        { talukName: "Srivaikundam", talukNameTamil: "ஸ்ரீவைகுண்டம்" },
        { talukName: "Kovilpatti", talukNameTamil: "கோவில்பட்டி" },
        { talukName: "Vilathikulam", talukNameTamil: "விளாத்திகுளம்" },
        { talukName: "Ottapidaram", talukNameTamil: "ஓட்டப்பிடாரம்" },
        { talukName: "Kayathar", talukNameTamil: "கயத்தார்" },
        { talukName: "Eral", talukNameTamil: "ஏரல்" },
      ],
      rtos: [
        { districtCode: "TUT", rtoCode: "TN69", rtoName: "Tuticorin" },
      ],
    },
    {
      districtCode: "TNV",
      districtName: "Tirunelveli",
      districtNameTamil: "திருநெல்வேலி",
      taluks: [
        { talukName: "Tirunelveli", talukNameTamil: "திருநெல்வேலி" },
        { talukName: "Palayamkottai", talukNameTamil: "பாளையங்கோட்டை" },
        { talukName: "Ambasamudram", talukNameTamil: "அம்பாசமுத்திரம்" },
        { talukName: "Nanguneri", talukNameTamil: "நாங்குநேரி" },
        { talukName: "Radhapuram", talukNameTamil: "இராதாபுரம்" },
        { talukName: "Manur", talukNameTamil: "மானூா்" },
        { talukName: "Cheranmahadevi", talukNameTamil: "சேரன்மகாதேவி" },
        { talukName: "Thisayanvilai", talukNameTamil: "திசையன்விளை" },
      ],
      rtos: [
        { districtCode: "TNV", rtoCode: "TN72", rtoName: "Tirunelveli" },
      ],
    },
    {
      districtCode: "KKU",
      districtName: "Kanniyakumari",
      districtNameTamil: "கன்னியாகுமரி",
      taluks: [
        { talukName: "Agasteeswaram", talukNameTamil: "அகஸ்தீஸ்வரம்" },
        { talukName: "Thovalai", talukNameTamil: "தோவாளை" },
        { talukName: "Kalkulam", talukNameTamil: "கல்குளம்" },
        { talukName: "Vilavamcode", talukNameTamil: "விளவங்கோடு" },
        { talukName: "Thiruvattar", talukNameTamil: "திருவட்டார்" },
        { talukName: "Killiyoor", talukNameTamil: "கிள்ளியூர்" },
      ],
      rtos: [
        { districtCode: "KKU", rtoCode: "TN74", rtoName: "Nagercoil" },
        { districtCode: "KKU", rtoCode: "TN75", rtoName: "Marthandam" },
      ],
    },
    {
      districtCode: "KGI",
      districtName: "Krishnagiri",
      districtNameTamil: "கிருஷ்ணகிரி",
      taluks: [
        { talukName: "Krishnagiri", talukNameTamil: "கிருஷ்ணகிரி" },
        { talukName: "Bargur", talukNameTamil: "பர்கூர்" },
        { talukName: "Uthangarai", talukNameTamil: "ஊத்தங்கரை" },
        { talukName: "Pochampalli", talukNameTamil: "போச்சம்பள்ளி" },
        { talukName: "Hosur", talukNameTamil: "ஓசூர்" },
        { talukName: "Denkanikotta", talukNameTamil: "டெங்கனிகோட்டா" },
        { talukName: "Shoolagiri", talukNameTamil: "சூளகிரி" },
        { talukName: "Anchetty", talukNameTamil: "அஞ்செட்டி" },
      ],
      rtos: [
        { districtCode: "KGI", rtoCode: "TN24", rtoName: "Krishnagiri" },
        { districtCode: "KGI", rtoCode: "TN70", rtoName: "Hosur" },
      ],
    },
    {
      districtCode: "TPR",
      districtName: "Tiruppur",
      districtNameTamil: "திருப்பூர்",
      taluks: [
        { talukName: "Tiruppur North", talukNameTamil: "திருப்பூர் வடக்கு" },
        { talukName: "Avinashi", talukNameTamil: "அவிநாசி" },
        { talukName: "Palladam", talukNameTamil: "பல்லடம்" },
        { talukName: "Dharapuram", talukNameTamil: "தாராபுரம்" },
        { talukName: "Kangayam", talukNameTamil: "காங்கயம்" },
        { talukName: "Udumalaipettai", talukNameTamil: "உடுமலைப்பேட்டை" },
        { talukName: "Madathukulam", talukNameTamil: "மடத்துக்குளம்" },
        { talukName: "Tiruppur South", talukNameTamil: "திருப்பூர் தெற்கு" },
        { talukName: "Uthukkuli", talukNameTamil: "ஊத்துக்குளி" },
      ],
      rtos: [
        { districtCode: "TPR", rtoCode: "TN39", rtoName: "Tirupur (North)" },
        { districtCode: "TPR", rtoCode: "TN42", rtoName: "Tirupur (South)" },
        { districtCode: "TPR", rtoCode: "TN78", rtoName: "Dharapuram" },
      ],
    },
    {
      districtCode: "KAL",
      districtName: "Kallakurichi",
      districtNameTamil: "கள்ளக்குறிச்சி",
      taluks: [
        { talukName: "Tirukkoilur", talukNameTamil: "திருக்கோயிலூர்" },
        { talukName: "Ulundurpet", talukNameTamil: "உளுந்தூர்பேட்டை" },
        { talukName: "Kallakurichi", talukNameTamil: "கள்ளக்குறிச்சி" },
        { talukName: "Sankarapuram", talukNameTamil: "சங்கராபுரம்" },
        { talukName: "Chinnasalem", talukNameTamil: "சின்னசேலம்" },
        { talukName: "Kalvarayan Hills", talukNameTamil: "கல்வராயன் மலை" },
      ],
      rtos: [
      ],
    },
    {
      districtCode: "TKS",
      districtName: "Tenkasi",
      districtNameTamil: "தென்காசி",
      taluks: [
        { talukName: "Sankarankovil", talukNameTamil: "சங்கரன்கோவில்" },
        { talukName: "Tenkasi", talukNameTamil: "தென்காசி" },
        { talukName: "Sivagiri", talukNameTamil: "சிவகிரி" },
        { talukName: "Shencottai", talukNameTamil: "செங்கோட்டை" },
        { talukName: "V.K.Pudur", talukNameTamil: "வீ. கே. புதூர்" },
        { talukName: "Alangulam", talukNameTamil: "ஆலங்குளம்" },
        { talukName: "Kadayanallur", talukNameTamil: "கடையநல்லூர்" },
        { talukName: "Thiruvengadam", talukNameTamil: "திருவேங்கடம்" },
      ],
      rtos: [
        { districtCode: "TKS", rtoCode: "TN76", rtoName: "Tenkasi" },
      ],
    },
    {
      districtCode: "CGP",
      districtName: "Chengalpattu",
      districtNameTamil: "செங்கல்பட்டு",
      taluks: [
        { talukName: "Chengalpattu", talukNameTamil: "செங்கல்பட்டு" },
        { talukName: "Tambaram", talukNameTamil: "தாம்பரம்" },
        { talukName: "Tirukalukundram", talukNameTamil: "திருக்கழுக்குன்றம்" },
        { talukName: "Maduranthagam", talukNameTamil: "மதுராந்தகம்" },
        { talukName: "Cheyyur", talukNameTamil: "செய்யூர்" },
        { talukName: "Thiruporur", talukNameTamil: "திருப்போரூர்" },
        { talukName: "Pallavaram", talukNameTamil: "பல்லாவரம்" },
        { talukName: "Vandalur", talukNameTamil: "வண்டலூர்" },
      ],
      rtos: [
        { districtCode: "CGP", rtoCode: "TN11", rtoName: "Tambaram" },
        { districtCode: "CGP", rtoCode: "TN19", rtoName: "Chengalpattu" },
      ],
    },
    {
      districtCode: "TPT",
      districtName: "Thirupathur",
      districtNameTamil: "திருப்பத்தூர்",
      taluks: [
        { talukName: "Vaniyambadi", talukNameTamil: "வாணியம்பாடி" },
        { talukName: "Tirupattur", talukNameTamil: "திருப்பத்தூர்" },
        { talukName: "Ambur", talukNameTamil: "ஆம்பூர்" },
        { talukName: "Natarampalli", talukNameTamil: "நாட்றம்பள்ளி" },
      ],
      rtos: [
      ],
    },
    {
      districtCode: "RPT",
      districtName: "Ranipet",
      districtNameTamil: "ராணிப்பேட்டை",
      taluks: [
        { talukName: "Arcot", talukNameTamil: "ஆற்காடு" },
        { talukName: "Arakkonam", talukNameTamil: "அரக்கோணம்" },
        { talukName: "Walajah", talukNameTamil: "வாலாசா" },
        { talukName: "Nemili", talukNameTamil: "நெமிலி" },
        { talukName: "Kalavai", talukNameTamil: "கலவை" },
        { talukName: "Sholinghur", talukNameTamil: "சோளிங்கர்" },
      ],
      rtos: [
        { districtCode: "RPT", rtoCode: "TN73", rtoName: "Ranipet" },
      ],
    },
    {
      districtCode: "MAY",
      districtName: "Mayiladuturai",
      districtNameTamil: "மயிலாடுதுறை",
      taluks: [
        { talukName: "Tharangambadi", talukNameTamil: "தரங்கம்பாடி" },
        { talukName: "Mayiladuthurai", talukNameTamil: "மயிலாடுதுறை" },
        { talukName: "Sirkazhi", talukNameTamil: "சீர்காழி" },
        { talukName: "Kuthalam", talukNameTamil: "குத்தாலம" },
      ],
      rtos: [
      ],
    },
  ],
};
