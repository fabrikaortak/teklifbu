import json
import csv
import re
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from collections import Counter, defaultdict

OUT = Path(__file__).resolve().parents[2] / "docs" / "vertical-taxonomy" / "packs"
NOW = datetime.now(timezone.utc).isoformat()

def slugify(s: str) -> str:
    tr = str.maketrans("çğıöşüÇĞİÖŞÜ", "cgiosuCGIOSU")
    s = s.translate(tr)
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s or "diger"

def parse_brands(text: str):
    return [x.strip() for x in text.split(",") if x.strip()]

def parse_series(text: str):
    """
    Format:
      Series
      Series|variant 1,variant 2
      separated by ;
    """
    out = {}
    for chunk in [c.strip() for c in text.split(";") if c.strip()]:
        if "|" in chunk:
            series_name, variants = chunk.split("|", 1)
            out[series_name.strip()] = [v.strip() for v in variants.split(",") if v.strip()]
        else:
            out[chunk] = []
    return out

# ---------------------------------------------------------------------
# 1) PUBLIC NAVIGATION BRAND SETS
# ---------------------------------------------------------------------
automobile_brands = parse_brands("""
Abarth, Acura, Aion, Alfa Romeo, Alpine, Anadol, Arora, Aston Martin, Audi, Bajaj,
Bentley, BMW, Buick, BYD, Cadillac, Chery, Chevrolet, Chrysler, Citroen, Cupra,
Dacia, Daewoo, Daihatsu, Dodge, DS Automobiles, Ferrari, Fiat, Ford, Geely,
Honda, Hyundai, Ikco, Infiniti, Isuzu, Jaguar, Jiayuan, Joyce, Kia, Kuba, Lada,
Lamborghini, Lancia, Leapmotor, Lexus, Lincoln, Lotus, Luqi, Marcos, Maserati,
Mazda, McLaren, Mercedes-Benz, MG, Micro, Mini, Mitsubishi, Morgan, Motolux,
Nieve, Nissan, Opel, Ortimobil, Peugeot, Plymouth, Polestar, Pontiac, Porsche,
Proton, Rainwoll, Reeder, Regal Raptor, Relive, Renault, RKS, Roewe, Rolls-Royce,
Rover, Saab, Seat, Skoda, Smart, Subaru, Suzuki, Tata, Tesla, The London Taxi,
Tofaş, TOGG, Toyota, Vanderhall, Volkswagen, Volta, Volvo, XEV, Yuki, Zlin Motors
""")

suv_brands = parse_brands("""
Alfa Romeo, ARO, Aston Martin, Audi, Bentley, BMW, BYD, Cadillac, Chery, Chevrolet,
Chrysler, Citroen, Cupra, Dacia, Daewoo, Daihatsu, DFM, DFSK, Dodge, DS Automobiles,
Ferrari, Fiat, Ford, Foton, GMC, Honda, Hongqi, Hummer, Hyundai, Infiniti, Isuzu,
Jaecoo, Jaguar, Jeep, KGM SsangYong, Kia, Lada, Lamborghini, Land Rover, Lexus,
Lincoln, Lotus, Lynk & Co, Mahindra, Maserati, Mazda, Mercedes-Benz, MG, Mini,
Mitsubishi, Nissan, Omoda, Opel, Peugeot, Porsche, Renault, Rolls-Royce, Santana,
Seat, Seres, Skoda, Skywell, Subaru, Suzuki, SWM, Tata, TOGG, Toyota, Volkswagen,
Volvo, Voyah
""")

minivan_brands = parse_brands("""
Askam, BMC, Chery, Chevrolet, Chrysler, Citroen, Dacia, DFM, DFSK, Dodge, Fiat,
Ford, GAZ, GMC, Hyundai, Iveco, Kia, Lancia, MAN, Maxus, Mazda, Mercedes-Benz,
Mitsubishi, Nissan, Opel, Peugeot, Pontiac, Renault, Seat, Skoda, Suzuki, Tenax,
Toyota, Volkswagen
""")

motorcycle_brands = parse_brands("""
Abush, Aeon, Altai, Apachi, Apec, Aprilia, Ariic, Arora, Asya, Bajaj, Barossa,
Belderia, Benda Motor, Benelli, Beta, Better, Bianchi, Bisan, BMW, Boom,
Borelli Ledow, Brixton, BSA, BuMoto/Jinling, Can-Am, CFmoto, Cheeta, Cosmopolitan,
CRN, CSN Motor, Çelik Motor, Daelim, Dayun, Delta Motorcycle, Derbi, Dofern,
Doohan, Dorado, Ducati, Enbest, Falcon, Fantic, FCM, Fosti, GasGas, Gilera,
Harley-Davidson, Hero, Honda, Husqvarna, Hyosung, Indian, Italjet, Jawa, Jialing,
Kanuni, Kawasaki, Keeway, Kral Motor, KTM, Kuba, Kymco, Lambretta, Lifan,
Malaguti, Mash, Meka, Mondial, Moto Guzzi, Motolux, Motron, MV Agusta, MZ,
Neco, NIU, Norton, Peugeot, Piaggio, Polaris, QJ Motor, RKS, Royal Alloy,
Royal Enfield, Salcano, Scomadi, Segway, Skyjet, Stmax, Super Soco, Suzuki,
SYM, TGB, Triumph, TVS, Vespa, Voge, Volta, Yamaha, Yuki, Zontes
""")

electric_brands = parse_brands("""
Aion, Audi, BMW, BYD, Citroen, Cupra, DS Automobiles, Fiat, Ford, Honda, Hyundai,
Jaguar, Jeep, Kia, Leapmotor, Lexus, Mercedes-Benz, MG, Mini, Nissan, Opel,
Peugeot, Polestar, Porsche, Renault, Seres, Skoda, Skywell, Smart, Subaru,
Tesla, TOGG, Toyota, Volkswagen, Volvo, Voyah, XEV
""")

# ---------------------------------------------------------------------
# 2) AUTOMOBILE SERIES / COMMON TURKEY-MARKET MODEL LABELS
#    Major branches are deeper; niche branches remain brand→series.
# ---------------------------------------------------------------------
AUTO = {}

def A(brand, spec):
    AUTO[brand] = parse_series(spec)

A("Abarth", "500;500C;595|1.4 T-Jet,Competizione,Turismo;695|Esseesse,Tributo 131;Grande Punto")
A("Acura", "CL;CSX;ILX;Integra;Legend;MDX;NSX;RDX;RL;RSX;TL;TLX;TSX;ZDX")
A("Aion", "ES;Hyper GT;S;S Plus;Y;Y Plus")
A("Alfa Romeo", """
33;75;145;146;147|1.6 TS Distinctive,1.9 JTD Distinctive,2.0 TS Selespeed;
155;156|1.6 TS,1.8 TS,2.0 TS Selespeed,1.9 JTD,2.4 JTD;
159|1.9 JTD Distinctive,2.0 JTDM,2.2 JTS;
164;166;Brera;Giulia|2.0 Turbo Sprint,2.0 Turbo Veloce,2.2 Diesel Super,Quadrifoglio;
Giulietta|1.4 TB Progression,1.4 TB Distinctive,1.6 JTD Progression,1.6 JTD Super;
GT|1.9 JTD Distinctive,2.0 JTS Selespeed;GTV;MiTo|1.4 TB Distinctive,1.3 JTD Progression;Spider
""")
A("Alpine", "A110|Pure,Legende,S,GT,R;A290|GT,GTS")
A("Anadol", "A1;A2;Böcek;P2;STC-16;SV-1600")
A("Arora", "S1;S1 Max;ZR1")
A("Aston Martin", "Cygnet;DB7;DB9;DB11;DB12;DBS;Lagonda;Rapide;Vanquish;Vantage;Virage")
A("Audi", """
80;90;100;200;A1|1.0 TFSI,1.4 TFSI,1.6 TDI;
A2;A3|1.0 TFSI,1.2 TFSI,1.4 TFSI,1.5 TFSI,1.6 TDI,2.0 TDI,S line;
A4|1.4 TFSI,1.8 T,2.0 TFSI,2.0 TDI,3.0 TDI,quattro,S line;
A5|1.4 TFSI,2.0 TFSI,2.0 TDI,quattro,S line;
A6|1.8 TFSI,2.0 TFSI,2.0 TDI,3.0 TDI,quattro,Design,S line;
A7|2.0 TFSI,3.0 TFSI,3.0 TDI,quattro;
A8|2.0 TFSI,3.0 TDI,4.0 TFSI,L quattro;
Cabrio;e-tron GT|quattro,RS e-tron GT;
R8;RS3;RS4;RS5;RS6;RS7;S1;S3;S4;S5;S6;S7;S8;TT|1.8 T,2.0 TFSI,TTS,TT RS
""")
A("Bajaj", "Qute")
A("Bentley", "Arnage;Azure;Bentayga;Brooklands;Continental GT;Continental Flying Spur;Flying Spur;Mulsanne;Turbo R")
A("BMW", """
1 Serisi|116d,116i,118d,118i,120d,120i,125i,M135i xDrive;
2 Serisi|216d Active Tourer,216d Gran Coupe,216d Gran Tourer,218i,218i Active Tourer,218i Gran Coupe,220d,220i,220 Gran Coupe,230i,M2;
3 Serisi|315,316i,318d,318i,320d,320d xDrive,320i,320i ED,325i,328i,330d,330i,330i xDrive,335i,340i xDrive;
4 Serisi|418i Gran Coupe,420d,420d xDrive,420i,420i Gran Coupe,428i,430i,430i xDrive,M4;
5 Serisi|518d,520d,520d xDrive,520i,523i,525d,525i,528i,530d,530i,530i xDrive,535d,535i,540i,M5;
6 Serisi|628Ci,630i,630d GT,640d,640i,650i,M6;
7 Serisi|725d,728i,730d,730Ld,730i,735i,740d,740i,745e,750i,760i;
8 Serisi|840d xDrive,840i xDrive,M8;
i Serisi|i3,i3s,i4 eDrive40,i4 M50,i5 eDrive40,i5 M60,i7 xDrive60,i8;
M Serisi|M1,M2,M3,M4,M5,M6,M8;
Z Serisi|Z1,Z3,Z4,Z8
""")
A("Buick", "Century;Electra;Enclave;Encore;Envision;LaCrosse;LeSabre;Park Avenue;Regal;Riviera;Roadmaster;Skylark")
A("BYD", "Dolphin|Comfort,Design;Han|Executive;Seal|Design,Excellence AWD;Seal U|Comfort,Design,DM-i;Atto 3|Design;Qin;Tang")
A("Cadillac", "ATS;BLS;CT4;CT5;CT6;CTS;DeVille;Eldorado;Fleetwood;Seville;STS;XLR")
A("Chery", "Alia;Chance;Kimo;Niche;Omoda 5;Tiggo 3;Tiggo 7;Tiggo 8")
A("Chevrolet", """
Aveo|1.2 S,1.2 SE,1.3 D LT,1.4 LT;
Camaro;Caprice;Corvette;Cruze|1.4 T,1.6 LS,1.6 LT,2.0 D LT;
Epica;Evanda;Kalos;Lacetti|1.4 SE,1.6 SX;
Malibu;Optra;Rezzo;Spark|1.0 LS,1.2 LT
""")
A("Chrysler", "300 C;300 M;Concorde;Crossfire;LeBaron;Neon;PT Cruiser;Sebring;Stratus;Vision")
A("Citroen", """
AX;BX;C1|1.0 Feel,1.0 Shine;C2|1.4 HDi SX;
C3|1.2 PureTech Feel,1.2 PureTech Shine,1.4 HDi,1.5 BlueHDi Feel,1.6 BlueHDi;
C4|1.2 PureTech Feel Bold,1.2 PureTech Shine,1.5 BlueHDi Feel,1.6 HDi;
C4 X|1.2 PureTech Feel,1.2 PureTech Shine,1.5 BlueHDi;
C5|1.6 HDi,1.6 e-HDi,2.0 HDi;C6;C8;DS3;DS4;DS5;
Saxo;Xantia;Xsara|1.4 SX,1.6 SX,2.0 HDi;Xsara Picasso|1.6 HDi,2.0 HDi;ZX
""")
A("Cupra", "Born|e-Boost;Leon|1.5 eTSI,2.0 TSI,VZ;Formentor|1.5 TSI,2.0 TSI,VZ,e-Hybrid")
A("Dacia", """
Logan|1.0 SCe Ambiance,1.5 dCi Ambiance,1.5 dCi Laureate,MCV;
Sandero|1.0 SCe Ambiance,1.0 TCe Comfort,1.5 dCi Stepway;
Solenza;Lodgy|1.5 dCi Laureate,Stepway;Dokker|1.5 dCi Ambiance,Stepway
""")
A("Daewoo", "Espero;Lanos;Leganza;Matiz;Nexia;Nubira;Racer;Tacuma;Tico")
A("Daihatsu", "Applause;Charade;Copen;Cuore;Materia;Mira;Sirion;YRV")
A("Dodge", "Avenger;Caliber;Challenger;Charger;Dart;Magnum;Neon;Stealth;Viper")
A("DS Automobiles", "DS 3|Performance Line,Rivoli;DS 4|Performance Line,Rivoli,Opera;DS 5;DS 9|Rivoli,Opera")
A("Ferrari", "296 GTB;348;360;458 Italia;488 GTB;550 Maranello;575M;599 GTB;612 Scaglietti;812 Superfast;California;F12 Berlinetta;F355;F430;FF;GTC4Lusso;Portofino;Roma;SF90 Stradale")
A("Fiat", """
124 Spider;126 Bis;500|1.0 Hybrid Dolcevita,1.2 Lounge,1.4 Sport;500C;500L|1.3 Multijet Lounge,1.6 Multijet Rockstar;500X;
Albea|1.2 Active,1.3 Multijet Active,1.4 Fire Dynamic;
Brava;Bravo|1.4 T-Jet Sport,1.6 Multijet Dynamic;
Egea Sedan|1.4 Fire Easy,1.3 Multijet Easy,1.6 Multijet Urban,1.6 Multijet Lounge,1.5 T4 Hibrit Cross;
Egea Hatchback|1.4 Fire Street,1.3 Multijet Urban,1.6 Multijet Lounge;
Egea Cross|1.4 Fire Street,1.3 Multijet Urban,1.6 Multijet Lounge,1.5 T4 Hibrit;
Linea|1.3 Multijet Active Plus,1.3 Multijet Urban,1.4 Fire Pop;
Marea;Palio|1.2 S,1.3 Multijet Active,1.4 EL;
Panda|1.2 Dynamic,1.3 Multijet,1.0 Hybrid;
Punto|1.2 Active,1.3 Multijet Easy,1.4 Fire Dynamic;Punto Evo;Siena;Stilo;Tempra;Tipo;Uno
""")
A("Ford", """
B-Max;C-Max|1.5 TDCi Titanium,1.6 TDCi Trend;Cougar;Escort;
Fiesta|1.0 EcoBoost Titanium,1.1 Trend,1.25 Trend,1.4 TDCi Trend,1.5 TDCi Titanium,ST;
Focus|1.0 EcoBoost Trend X,1.5 EcoBlue Titanium,1.5 TDCi Trend X,1.6 TDCi Titanium,1.6 Ti-VCT Trend X,ST,RS;
Fusion|1.4 TDCi Comfort;Galaxy;Ka;Mondeo|1.5 EcoBoost Titanium,1.6 TDCi Titanium,2.0 TDCi Titanium;
Mustang|2.3 EcoBoost,5.0 GT;Probe;Scorpio;Sierra;StreetKa;Taurus;Tourneo Courier;Tourneo Connect
""")
A("Geely", "CK;Echo;Emgrand EC7;Emgrand GT;FC;MK;Otaka")
A("Honda", """
Accord|2.0 Executive,2.4 Executive;
City|1.4 ES,1.5 Elegance,1.5 Executive;
Civic|1.4 iS,1.5 Turbo Eco Elegance,1.5 Turbo Executive Plus,1.6 Eco Elegance,1.6 i-VTEC Elegance,1.6 i-VTEC Executive;
CR-Z;CRX;E;Insight;Integra;Jazz|1.3 Dream,1.3 Elegance,1.4 ES;
Legend;NSX;Prelude;S2000;Stream
""")
A("Hyundai", """
Accent|1.3 LS,1.5 CRDi Admire,1.6 Era Select;Accent Blue|1.4 Mode,1.6 CRDi Mode Plus;
Atos;Coupe;Elantra|1.6 D-CVVT Mode,1.6 MPI Style,1.6 CRDi Elite;
Excel;Genesis;Getz|1.4 DOHC,1.5 CRDi VGT;
i10|1.0 Jump,1.0 Style,1.2 Elite;i20|1.0 T-GDI Style,1.2 MPI Jump,1.4 CRDi Style;
i30|1.4 MPI,1.6 CRDi Elite;Ioniq|Hybrid,Electric;
Matrix;Pony;Sonata|2.0 GLS,2.0 CRDi;Veloster
""")
A("Ikco", "Dena;Runna;Samand|1.6 LX")
A("Infiniti", "G;I30;M;Q30;Q40;Q50;Q60;Q70")
A("Isuzu", "Gemini;Stylus")
A("Jaguar", "Daimler;F-Type;S-Type;XE|2.0 D Prestige,2.0 P R-Dynamic;XF|2.0 D Prestige,2.0 P R-Sport;XJ;XK;X-Type")
A("Jiayuan", "City Spirit;Komı;Lingzu;M2")
A("Joyce", "One")
A("Kia", """
Carens;Carnival;Ceed|1.4 Cool,1.6 CRDi Concept Plus,GT-Line;Cerato|1.5 CRDi EX,1.6 EX;
Clarus;Magentis;Opirus;Optima|1.7 CRDi Prestige,2.0 Hybrid;Picanto|1.0 Feel,1.2 Cool;
Pride;ProCeed;Rio|1.25 Cool,1.4 CRDi Concept,1.4 CVVT Fancy;Sephia;Shuma;Stinger
""")
A("Kuba", "City;Eco;Mini")
A("Lada", "110;111;112;Kalina;Niva;Priora;Samara;Vaz;Vesta")
A("Lamborghini", "Aventador;Countach;Diablo;Gallardo;Huracan;Murcielago;Revuelto")
A("Lancia", "Delta;Dedra;Kappa;Lybra;Musa;Thema;Thesis;Ypsilon")
A("Leapmotor", "T03|Design;C01;C10|Design;C11")
A("Lexus", "CT|200h;ES|250,300h;GS|250,300h,450h;IS|200t,250,300h;LC|500,500h;LS|460,500h;RC|200t,300h;SC")
A("Lincoln", "Continental;LS;Mark;MKZ;Town Car;Zephyr")
A("Lotus", "Elan;Elise;Emira;Esprit;Evora;Exige")
A("Luqi", "EV3")
A("Marcos", "GT;Mantis;Mantula")
A("Maserati", "3200 GT;Ghibli|Diesel,GranSport,Hybrid;GranCabrio;GranTurismo;MC20;Quattroporte")
A("Mazda", """
121;2|1.3 Go,1.5 Power;3|1.5 Skyactiv-G Power,1.6 Impressive;
323;5;6|2.0 Power,2.2 Skyactiv-D;626;929;Lantis;Millenia;MX-3;MX-5;MX-6;RX-7;RX-8;Xedos
""")
A("McLaren", "540C;570S;600LT;650S;675LT;720S;750S;Artura;GT;MP4-12C;P1;Senna")
A("Mercedes-Benz", """
A Serisi|A 140,A 150,A 160,A 180 CDI,A 180 d,A 180,A 200 AMG,A 200 d,A 250 e,A 35 AMG,A 45 AMG;
AMG GT|GT 43,GT 53,GT 63 S;
B Serisi|B 150,B 160,B 180 CDI,B 180 d,B 180,B 200;
C Serisi|C 180 Kompressor,C 180 AMG,C 200 d,C 200 AMG,C 220 CDI,C 220 d,C 250 CDI,C 250,C 300 d,C 300 e,C 43 AMG,C 63 AMG;
CLA|CLA 180 d,CLA 180,CLA 200,CLA 220 d,CLA 250 e,CLA 35 AMG,CLA 45 AMG;
CLE|CLE 200,CLE 300 4MATIC,CLE 53 AMG;
CLK;CLS|CLS 250 CDI,CLS 300 d,CLS 350 CDI,CLS 400 d,CLS 450,CLS 53 AMG,CLS 63 AMG;
E Serisi|E 180,E 200 d,E 200,E 220 CDI,E 220 d,E 250 CDI,E 250,E 300 d,E 300 e,E 350 CDI,E 400 d,E 450,E 53 AMG,E 63 AMG;
EQE|EQE 300,EQE 350+,EQE 500 4MATIC,AMG EQE 53;
EQS|EQS 450+,EQS 580 4MATIC,AMG EQS 53;
S Serisi|S 280,S 320 CDI,S 350 d,S 400 d,S 450,S 500,S 580,S 63 AMG,S 600;
SL;SLC;SLK;SLS AMG;190;200;230;240;250;260;280;300;320;380;400;420;500;560
""")
A("MG", "MG3;MG4|Comfort,Luxury,XPower;MG5;MG6;MG7;ZS|Comfort,Luxury,EV;HS|Comfort,Luxury,PHEV")
A("Micro", "Microlino|Lite,Dolce,Competizione")
A("Mini", "Cooper|One,Cooper,Cooper S,JCW;Cooper Clubman;Cooper Countryman;Cooper Coupe;Cooper Paceman;Cooper Roadster")
A("Mitsubishi", "Carisma;Colt|1.3 Invite,1.5 Instyle;Eclipse;Galant;Grandis;Lancer|1.5 Invite,1.6 Invite,1.8 Intense;Mirage;Space Star")
A("Morgan", "3 Wheeler;4/4;Aero 8;Plus 4;Plus 6;Roadster")
A("Motolux", "E-Dream;F5;M5")
A("Nissan", """
200 SX;300 ZX;Almera|1.5 Tekna,1.5 dCi;Altima;Bluebird;Cube;GT-R;Laurel;Leaf|Visia,Tekna;
Maxima;Micra|1.0 IG-T Tekna,1.2 Match,1.5 dCi;Note|1.2 Tekna,1.5 dCi;Primera;Pulsar;Silvia;Skyline;Sunny;Tiida
""")
A("Opel", """
Adam;Agila;Ampera;Ascona;Calibra;Cascada;
Corsa|1.0,1.0 T,1.2,1.2 Hibrit,1.2 T,1.2 Twinport,1.3 CDTI,1.4,1.4 Twinport,1.5 D,1.5 TD,1.6,1.7 DTI Comfort;
Astra|1.2 T Edition,1.3 CDTI Enjoy,1.4 T Dynamic,1.5 D Elegance,1.6 CDTI Enjoy,1.6 Edition;
Insignia|1.5 T Grand Sport,1.6 CDTI Design,1.6 T Cosmo,2.0 CDTI Cosmo;
Kadett;Meriva|1.3 CDTI Enjoy,1.6 CDTI Cosmo;Omega;Rekord;Senator;Signum;Tigra;Vectra|1.6 Comfort,2.0 CDX;Zafira|1.6 Enjoy,1.9 CDTI Cosmo
""")
A("Peugeot", """
106;107;108;205;206|1.4 HDi X-Line,1.4 XR,1.6 XT;207|1.4 HDi Trendy,1.4 VTi Active,1.6 HDi Premium;
208|1.2 PureTech Active,1.2 PureTech Allure,1.2 PureTech GT,1.5 BlueHDi Active,e-208 GT;
301|1.2 PureTech Active,1.5 BlueHDi Allure,1.6 HDi Active;
305;306;307|1.4 HDi XR,1.6 HDi Premium,1.6 XT;308|1.2 PureTech Allure,1.2 PureTech GT,1.5 BlueHDi Allure,1.6 HDi Active;
405;406;407|1.6 HDi Comfort,2.0 HDi Executive;508|1.5 BlueHDi Allure,1.6 PureTech GT,Hybrid GT;
605;607;RCZ
""")
A("Plymouth", "Barracuda;Belvedere;Fury;Neon;Prowler;Road Runner;Satellite;Voyager")
A("Polestar", "1;2|Long Range Single Motor,Long Range Dual Motor;3;4")
A("Pontiac", "Bonneville;Firebird;G5;G6;Grand Am;Grand Prix;GTO;Solstice;Sunfire;Trans Am")
A("Porsche", """
718|Boxster,Cayman,GTS 4.0;911|Carrera,Carrera S,Carrera 4S,Targa 4S,Turbo S,GT3,GT3 RS;
Boxster;Cayman;Panamera|2.9 4,4 E-Hybrid,GTS,Turbo S;Taycan|4S,GTS,Turbo,Turbo S
""")
A("Proton", "315;316;Persona;Saga;Savvy;Satria;Waja;Wira")
A("Renault", """
Clio|1.0 SCe Joy,1.0 TCe Touch,1.0 TCe Icon,1.0 TCe Evolution,1.0 TCe Techno,1.2 Joy,1.5 dCi Joy,1.5 dCi Icon;
Fluence|1.5 dCi Business,1.5 dCi Icon,1.6 Extreme;
Laguna;Latitude;Megane|1.3 TCe Joy,1.3 TCe Icon,1.5 Blue dCi Touch,1.5 dCi Icon,1.6 Joy,1.6 Touch;
R19;R21;R25;R9;R11;Safrane;Scenic;Symbol|1.2 Joy,1.5 dCi Joy,1.5 dCi Touch;
Taliant|1.0 SCe Joy,1.0 TCe Touch;Twingo;Vel Satis;Zoe|Intens
""")
A("Rolls-Royce", "Corniche;Cullinan;Dawn;Ghost;Phantom;Silver Cloud;Silver Seraph;Silver Shadow;Spectre;Wraith")
A("Rover", "25;45;75;200;400;600;800;Mini")
A("Saab", "9-3;9-5;900;9000;96;99")
A("Seat", "Alhambra;Altea;Arosa;Cordoba|1.4 Reference,1.6 Stylance;Exeo;Ibiza|1.0 EcoTSI Style,1.2 TSI Reference,1.4 TDI Style;Leon|1.0 eTSI Style,1.5 eTSI FR,1.6 TDI Style,2.0 TSI Cupra;Toledo")
A("Skoda", "Citigo;Fabia|1.0 TSI Elite,1.2 TSI Ambition,1.4 TDI Style;Favorit;Felicia;Octavia|1.0 eTSI Elite,1.5 TSI Premium,1.6 TDI Optimal,2.0 TDI Prestige;Rapid|1.4 TDI Style;Scala|1.0 TSI Premium,1.5 TSI;Superb|1.5 TSI Prestige,1.6 TDI Style,2.0 TDI L&K")
A("Smart", "Forfour;Fortwo|Passion,Prime;Roadster;#1|Premium,Brabus;#3|Premium,Brabus")
A("Subaru", "BRZ;Impreza|1.5 AWD,2.0 WRX,WRX STI;Justy;;#1|PremiumLegacy|2.0 AWD;Levorg;SVX")
A("Suzuki", "Alto;Baleno|1.2 GLX;Celerio;Ignis|1.2 GLX;Kizashi;Liana;Maruti;Splash;Swift|1.2 GL,1.2 GLX,1.4 Sport;Wagon R")
A("Tata", "Indica;Indigo;Manza;Nano;Vista")
A("Tesla", "Model 3|RWD,Long Range AWD,Performance;Model S|Long Range,Plaid;Model X|Long Range,Plaid")
A("The London Taxi", "TX1;TX2;TX4;TX Electric")
A("Tofaş", "Doğan|L,SL,SLX;Kartal|L,SL,SLX;Murat 124;Murat 131;Serçe;Şahin|S,SLX")
A("TOGG", "T10F|V1 RWD Standart Menzil,V1 RWD Uzun Menzil,V2 RWD Uzun Menzil")
A("Toyota", """
Auris|1.33 Life,1.4 D-4D Advance,1.6 Advance,Hybrid;
Avensis|1.6 Elegant,2.0 D-4D Elegant;Camry|2.5 Hybrid Passion;Carina;Celica;
Corolla|1.33 Life,1.4 D-4D Touch,1.5 Vision,1.5 Dream,1.6 Advance,1.8 Hybrid Dream,1.8 Hybrid Passion X-Pack;
Corona;GT86;MR2;Prius;Starlet;Supra;Urban Cruiser;
Yaris|1.0 Vision,1.33 Fun,1.4 D-4D Cool,1.5 Dream,1.5 Hybrid Passion
""")
A("Volkswagen", """
Arteon|1.5 TSI Elegance,2.0 TDI R-Line;
Beetle;Bora|1.6 Comfortline,1.9 TDI Highline;CC|1.4 TSI Exclusive,2.0 TDI;
Eos;Golf|1.0 eTSI Life,1.2 TSI Comfortline,1.4 TSI Highline,1.5 eTSI R-Line,1.6 TDI Comfortline,2.0 TDI GTD,GTI,R;
ID.3|Pro,Pro S;Jetta|1.2 TSI Trendline,1.6 TDI Comfortline;
Lupo;Passat|1.4 TSI Comfortline,1.5 TSI Business,1.6 TDI Impression,2.0 TDI Elegance;
Phaeton;Polo|1.0 Impression,1.0 TSI Life,1.2 TSI Comfortline,1.4 TDI Trendline,GTI;
Scirocco|1.4 TSI Sportline,2.0 TSI R;Vento
""")
A("Volvo", """
C30;C70;S40|1.6 D Drive,1.6 Dynamic;S60|1.5 T3 Premium,1.6 D2 Advance,2.0 D4 Inscription,T8 Recharge;
S70;S80|1.6 D2 Advance,2.0 D4 Summum;S90|B5 AWD Inscription,D5 AWD Inscription,T8 Recharge;
V40|1.5 T3 Cross Country,1.6 D2 Advance,2.0 D4 R-Design;V50;V60;V70;V90
""")

# Niche brands: sensible series-level coverage
for brand, spec in {
    "Joyce": "One",
    "Nieve": "Niev 1;Niev 2",
    "Ortimobil": "O2;O4",
    "Rainwoll": "RW10;RW20",
    "Reeder": "ReeV Fancy;ReeV Max",
    "Regal Raptor": "K5;Pilder",
    "Relive": "N1",
    "RKS": "A1;D2;M5",
    "Roewe": "Ei5;i5;i6",
    "Vanderhall": "Carmel;Venice",
    "Volta": "EV1;EV2;EV4",
    "XEV": "Yoyo",
    "Yuki": "Amy;Tria",
    "Zlin Motors": "Z2;Z3",
    "Kuba": "City;Eco;Mini",
    "Luqi": "EV3;M1",
    "Motolux": "E-Dream;F5;M5",
}.items():
    if brand not in AUTO:
        A(brand, spec)

# ---------------------------------------------------------------------
# 3) SUV / PICKUP
# ---------------------------------------------------------------------
SUV = {}
def S(brand, spec): SUV[brand] = parse_series(spec)

S("Alfa Romeo", "Junior|Ibrida,Elettrica;Stelvio|2.0 Turbo Sprint,2.2 Diesel Super,Quadrifoglio;Tonale|1.5 Hybrid Ti,1.6 Diesel Sprint,PHEV Veloce")
S("ARO", "10;24;Spartana")
S("Aston Martin", "DBX|550,707")
S("Audi", "Q2|30 TFSI,35 TFSI,S line;Q3|35 TFSI,35 TDI,45 TFSI e,S line;Q4 e-tron|40,45 quattro,50 quattro;Q5|40 TDI quattro,45 TFSI quattro,55 TFSI e;Q6 e-tron;Q7|45 TDI quattro,50 TDI quattro,55 TFSI;Q8|50 TDI quattro,55 TFSI,60 TFSI e;Q8 e-tron|50 quattro,55 quattro;SQ5;SQ7;SQ8;RS Q3;RS Q8")
S("Bentley", "Bentayga|V8,Speed,Hybrid,Azure")
S("BMW", """
iX|xDrive40,xDrive50,M60;iX1|eDrive20,xDrive30;iX2|eDrive20,xDrive30;iX3|Inspiring,Impressive;
X1|sDrive16d,sDrive18i,sDrive20i,xDrive20d,xDrive25e;
X2|sDrive18i,sDrive20i,xDrive20d,M35i;
X3|16d sDrive,18d xDrive,20d xDrive,20i sDrive,20i xDrive,30e xDrive,M40i;
X4|20d xDrive,20i xDrive,30d xDrive,M40i;
X5|25d sDrive,30d xDrive,40d xDrive,45e xDrive,50e xDrive,M50i;
X6|30d xDrive,40d xDrive,M50d,M60i;
X7|30d xDrive,40d xDrive,M50d,M60i
""")
S("BYD", "Atto 3|Design;Seal U|Comfort,Design,DM-i Design,DM-i Excellence;Tang|Flagship")
S("Cadillac", "Escalade;SRX;XT4;XT5;XT6")
S("Chery", "Tiggo 3;Tiggo 4 Pro;Tiggo 7 Pro|Comfort,Luxury,Excellent;Tiggo 8 Pro|Luxury,Excellent;Tiggo 8 Pro Max")
S("Chevrolet", "Blazer;Captiva|2.0 D LT,2.0 D LTZ;Equinox;Suburban;Tahoe;Trailblazer;Tracker|1.2 Turbo LT")
S("Chrysler", "Aspen;Pacifica")
S("Citroen", "C3 Aircross|1.2 PureTech Feel Bold,1.5 BlueHDi Shine;C4 Cactus|1.2 PureTech Feel,1.6 BlueHDi Shine;C5 Aircross|1.2 PureTech Feel,1.5 BlueHDi Shine,Hybrid e-Series")
S("Cupra", "Ateca|2.0 TSI;Formentor|1.5 TSI,2.0 TSI,VZ,e-Hybrid;Tavascan|Endurance,VZ")
S("Dacia", "Duster|1.0 TCe Comfort,1.3 TCe Prestige,1.5 dCi 4x4 Prestige,1.6 4x2 Laureate;Spring|Extreme;Bigster")
S("Daihatsu", "Feroza;Rocky;Terios")
S("DFM", "Rich;Succe")
S("DFSK", "Fengon 500;Fengon 5;Fengon 580;Glory 330;Glory 500;Seres 3")
S("Dodge", "Durango;Journey;Nitro;Ram")
S("DS Automobiles", "DS 3 Crossback|Performance Line,Rivoli;DS 7|Performance Line,Rivoli,Opera;DS 7 Crossback")
S("Ferrari", "Purosangue")
S("Fiat", "500X|1.0 FireFly Cross,1.3 FireFly Lounge,1.6 Multijet Cross;Freemont|2.0 Multijet Lounge;Fullback|2.4 D 4x4;Panda 4x4;Sedici;Toro")
S("Ford", "Bronco;Edge;Escape;Everest;Explorer;Kuga|1.5 EcoBoost Style,1.5 EcoBlue Titanium,2.5 PHEV ST-Line;Maverick;Puma|1.0 EcoBoost Style,1.0 EcoBoost Titanium,ST;Ranger|2.0 EcoBlue Wildtrak,2.0 Bi-Turbo Raptor,2.2 TDCi XLT,3.2 TDCi Wildtrak")
S("Foton", "Sauvana;Tunland|G7,G9,V9")
S("GMC", "Acadia;Canyon;Envoy;Hummer EV;Sierra;Terrain;Yukon")
S("Honda", "CR-V|1.5 VTEC Turbo Executive,1.6 i-DTEC Elegance,2.0 Hybrid Executive;HR-V|1.5 e:HEV Advance,1.5 i-VTEC Executive;Pilot;ZR-V|2.0 e:HEV Advance")
S("Hongqi", "E-HS9|Executive,Premium;HS5;HS7")
S("Hummer", "H1;H2;H3")
S("Hyundai", "Bayon|1.0 T-GDI Elite,1.4 MPI Jump;Kona|1.0 T-GDI Elite,1.6 Hybrid Smart,Electric;Santa Fe|2.2 CRDi Elite;Tucson|1.6 CRDi Elite,1.6 T-GDI Prime Plus,1.6 Hybrid Elite Plus;Terracan;ix35;Ioniq 5|Progressive,AWD;Ioniq 9")
S("Infiniti", "EX;FX;JX;QX30;QX50;QX55;QX60;QX70;QX80")
S("Isuzu", "D-Max|1.9 V-Life,1.9 V-Cross,2.5 4x4;Trooper;VehiCross")
S("Jaecoo", "J7|Revive,Evolve,4x4;J8")
S("Jaguar", "E-Pace|D150 R-Dynamic,P200;F-Pace|D180 R-Sport,P250 R-Dynamic;I-Pace|EV400 HSE")
S("Jeep", "Avenger|Longitude,Limited,Electric;Cherokee|2.0 MJD Limited;Commander;Compass|1.3 GSE Limited,1.6 MJD Longitude,4xe;Grand Cherokee|3.0 CRD Limited,4xe Summit;Renegade|1.0 T3 Limited,1.3 T4 S,1.6 MJD Longitude;Wrangler|2.0 Rubicon,3.6 Sahara,4xe")
S("KGM SsangYong", "Actyon;Korando|1.5 GDI Turbo Platinum,1.6 e-XDI Dream;Kyron;Musso Grand|2.2 e-XDI Platinum;Rexton|2.2 e-XDI Platinum;Tivoli|1.5 GDI Turbo Platinum;Torres|1.5 GDI Turbo,EVX")
S("Kia", "EV3|Elegance,Prestige;EV6|Long Range,GT;EV9|GT-Line;Niro|Hybrid Prestige,EV Prestige;Sorento|1.6 T-GDI Hybrid Prestige;Sportage|1.6 CRDi Elegance,1.6 T-GDI Prestige,Hybrid;Stonic|1.0 T-GDI Elegance,1.4 Cool;Soul")
S("Lada", "Niva|1.7,Travel")
S("Lamborghini", "Urus|S,Performante,SE")
S("Land Rover", "Defender|90,110,130;Discovery|Sport,D250,R-Dynamic;Freelander;Range Rover|D350,HSE,Autobiography;Range Rover Evoque|D150,S,R-Dynamic;Range Rover Sport|D300,HSE,SV;Range Rover Velar|D200,R-Dynamic")
S("Lexus", "LBX|Elegant,Relax;NX|250,350h,450h+;RX|300,350h,450h+,500h;UX|250h,300e;GX;LX")
S("Lincoln", "Aviator;Corsair;MKC;Navigator")
S("Lotus", "Eletre|S,R")
S("Lynk & Co", "01|Hybrid,Plug-in Hybrid;02;05;08")
S("Mahindra", "Bolero;Goa;KUV100;Scorpio;XUV500")
S("Maserati", "Grecale|GT,Modena,Trofeo,Folgore;Levante|Diesel,GranSport,Trofeo")
S("Mazda", "CX-3|1.5 Skyactiv-D Power;CX-30|2.0 Skyactiv-G Power;CX-5|2.0 Skyactiv-G Power,2.2 Skyactiv-D;CX-60|PHEV,Diesel;CX-7;CX-9;MX-30")
S("Mercedes-Benz", """
EQA|EQA 250,EQA 250+,EQA 350 4MATIC;EQB|EQB 250+,EQB 350 4MATIC;
EQC|EQC 400 4MATIC;EQE SUV|EQE 350+,EQE 500 4MATIC,AMG EQE 53;
EQS SUV|EQS 450+,EQS 580 4MATIC;
G Serisi|G 350 d,G 400 d,G 500,G 63 AMG;
GLA|GLA 180,GLA 200,GLA 200 d,GLA 250 e,GLA 35 AMG;
GLB|GLB 180 d,GLB 200,GLB 200 d,GLB 250 4MATIC;
GLC|GLC 220 d,GLC 250 d,GLC 300 d,GLC 300 e,GLC 43 AMG,GLC 63 AMG;
GLE|GLE 300 d,GLE 350 d,GLE 400 d,GLE 450,GLE 53 AMG,GLE 63 AMG;
GLS|GLS 350 d,GLS 400 d,GLS 450,GLS 580,GLS 63 AMG;GLK;ML;Maybach GLS
""")
S("MG", "HS|Comfort,Luxury,PHEV;Marvel R|Performance;ZS|Comfort,Luxury,EV")
S("Mini", "Countryman|Cooper,Cooper S,Cooper SE,JCW;Aceman|E,SE")
S("Mitsubishi", "ASX|1.3 Turbo Intense,1.6 Invite;Eclipse Cross|1.5 Turbo Instyle,PHEV;L200|2.4 DI-D Invite,2.4 DI-D Intense;Outlander|2.0 Invite,PHEV;Pajero")
S("Nissan", "Ariya|Advance,Evolve;Juke|1.0 DIG-T Tekna,1.6 Hybrid;Murano;Navara|2.3 dCi Platinum,2.5 dCi 4x4;Pathfinder;Qashqai|1.3 DIG-T Designpack,1.5 dCi Sky Pack,e-Power;Terrano;X-Trail|1.5 VC-T e-Power,1.6 dCi Platinum")
S("Omoda", "Omoda 5|Comfort,Excellent,EV")
S("Opel", "Antara;Crossland|1.2 Turbo Edition,1.5 D Elegance;Frontera|Hybrid,Electric;Grandland|1.2 Turbo Edition,1.5 D Ultimate,Hybrid;Mokka|1.2 Turbo Elegance,1.5 D Ultimate,Elektrik;Mokka X")
S("Peugeot", "2008|1.2 PureTech Active,1.2 PureTech Allure,1.5 BlueHDi GT,e-2008;3008|1.2 PureTech Active Prime,1.5 BlueHDi Allure,1.6 Hybrid GT;4007;4008;5008|1.2 PureTech Allure,1.5 BlueHDi GT,Hybrid")
S("Porsche", "Cayenne|3.0,Coupe,E-Hybrid,GTS,Turbo GT;Macan|2.0,S,GTS,Turbo,Electric 4,Electric Turbo")
S("Renault", "Arkana|1.3 TCe Icon,E-Tech;Austral|Mild Hybrid Techno,Full Hybrid Esprit Alpine;Captur|1.0 TCe Touch,1.3 TCe Icon,E-Tech;Kadjar|1.2 TCe Touch,1.5 dCi Icon;Koleos|1.6 dCi Icon,2.0 dCi 4x4;Rafale|E-Tech Esprit Alpine;Scenic E-Tech;Symbioz")
S("Rolls-Royce", "Cullinan|Black Badge")
S("Seat", "Arona|1.0 EcoTSI Style,1.0 EcoTSI Xperience;Ateca|1.5 EcoTSI Xperience,2.0 TDI FR;Tarraco|1.5 EcoTSI Xcellence")
S("Seres", "Seres 3|Comfort,Premium;Seres 5|Premium")
S("Skoda", "Elroq|50,60,85;Enyaq|60,80,85,Coupe RS;Kamiq|1.0 TSI Elite,1.5 TSI Premium;Karoq|1.5 TSI Prestige,2.0 TDI 4x4;Kodiaq|1.5 TSI Prestige,2.0 TDI L&K")
S("Skywell", "ET5|Long Range,LR Legend")
S("Subaru", "Crosstrek|e-Boxer;Forester|2.0i e-Boxer,2.0 XT;Outback|2.5i Touring;Solterra|e-Xtreme;Tribeca;XV|1.6i Comfort,2.0i Premium")
S("Suzuki", "Across|PHEV;Jimny|1.5 GLX;S-Cross|1.4 Boosterjet GLX,Hybrid;Vitara|1.4 Boosterjet GLX,1.6 GL+")
S("SWM", "G01|Elite,Premium;G01F;G03F;G05")
S("Tata", "Safari;Telcoline;Xenon")
S("TOGG", "T10X|V1 RWD Standart Menzil,V1 RWD Uzun Menzil,V2 RWD Uzun Menzil")
S("Toyota", "C-HR|1.2 Turbo Advance,1.8 Hybrid Passion,2.0 Hybrid GR Sport;Highlander|2.5 Hybrid;Hilux|2.4 D-4D Adventure,2.4 D-4D Hi-Cruiser;Land Cruiser|Prado,250,300;RAV4|2.0 Adventure,2.5 Hybrid Passion X-Sport;Yaris Cross|1.5 Hybrid Dream,1.5 Hybrid Flame")
S("Volkswagen", "ID.4|Pure,Pro,GTX;ID.5|Pro,GTX;T-Cross|1.0 TSI Life,1.0 TSI Style;Taigo|1.0 TSI Life,1.5 TSI Style;Tiguan|1.5 eTSI Life,2.0 TDI Elegance;Touareg|3.0 TDI Elegance,R eHybrid;T-Roc|1.0 TSI Life,1.5 TSI R-Line;Amarok|2.0 TDI Life,3.0 V6 Aventura")
S("Volvo", "C40 Recharge|Single Motor,Twin Motor;EX30|Single Motor Extended Range,Twin Motor Performance;EX40;EX90;XC40|T3 Momentum,B4 Mild Hybrid,Recharge;XC60|B4 Plus,D4 Inscription,T8 Recharge;XC90|B5 Plus,D5 Inscription,T8 Recharge")
S("Voyah", "Free|Standard,Long Range;Dream;Passion")

# ---------------------------------------------------------------------
# 4) MINIVAN / PANELVAN
# ---------------------------------------------------------------------
MINIVAN = {}
def V(brand, spec): MINIVAN[brand] = parse_series(spec)

V("Citroen", "Berlingo|1.5 BlueHDi Feel,1.5 BlueHDi Shine,Van;Jumpy|1.5 BlueHDi,2.0 BlueHDi;Jumper|2.2 BlueHDi L2H2,2.2 BlueHDi L4H3;Nemo|1.3 HDi")
V("Dacia", "Dokker|1.5 dCi Ambiance,1.5 dCi Stepway;Lodgy|1.5 dCi Laureate,1.5 dCi Stepway")
V("Fiat", "Doblo Cargo|1.3 Multijet,1.6 Multijet,1.9 D;Doblo Combi|1.3 Multijet Safeline,1.6 Multijet Premio;Fiorino Cargo|1.3 Multijet;Fiorino Panorama|1.3 Multijet Pop,Premio;Ducato|2.2 Multijet L2H2,2.3 Multijet L4H3;Scudo|2.0 Multijet;Talento|1.6 Multijet")
V("Ford", "Tourneo Courier|1.0 EcoBoost Titanium,1.5 TDCi Titanium;Transit Courier|1.5 EcoBlue Trend;Tourneo Connect|1.5 EcoBlue Titanium;Transit Connect|1.5 TDCi Trend;Tourneo Custom|2.0 EcoBlue Titanium;Transit Custom|2.0 EcoBlue Trend;Transit|2.0 EcoBlue 350L,2.2 TDCi 350M")
V("Hyundai", "H-1|2.5 CRDi Elite,Panelvan;H100|2.5 CRDi")
V("Iveco", "Daily|35C15,35S16,50C15,70C15")
V("Kia", "Pregio;Besta;Carnival")
V("Maxus", "Deliver 3|Electric;Deliver 7|Diesel,Electric;Deliver 9|Diesel,Electric;eDeliver 5;eDeliver 9")
V("Mercedes-Benz", "Citan|108 CDI,109 CDI,111 CDI;Vaneo;Viano|2.2 CDI Ambiente;Vito|111 CDI,114 CDI,119 CDI Tourer;Sprinter|313 CDI,315 CDI,316 CDI,319 CDI,413 CDI,515 CDI")
V("Mitsubishi", "L300|2.5 D;L400")
V("Nissan", "NV200|1.5 dCi,Evalia;NV300|1.6 dCi;NV400|2.3 dCi;Primastar;Townstar|EV;Vanette")
V("Opel", "Combo|1.3 CDTI City Plus,1.5 D Edition;Vivaro|1.6 CDTI,2.0 D;Movano|2.3 CDTI L3H2")
V("Peugeot", "Bipper|1.3 HDi;Partner|1.5 BlueHDi Premium,1.6 HDi Tepee;Rifter|1.5 BlueHDi Allure;Expert|1.5 BlueHDi,2.0 BlueHDi;Boxer|2.2 BlueHDi L3H2")
V("Renault", "Kangoo|1.5 dCi Express,1.5 dCi Multix;Express Van|1.5 Blue dCi;Trafic|1.6 dCi,2.0 Blue dCi;Master|2.3 dCi L2H2,2.3 dCi L4H3")
V("Toyota", "Proace City|1.5 D Dream,1.5 D Cargo;Proace|2.0 D Comfort;Hiace")
V("Volkswagen", "Caddy|1.6 TDI Comfortline,2.0 TDI Life,Cargo;Transporter|2.0 TDI City Van,Panel Van,Caravelle;Crafter|2.0 TDI L3H2,L4H3;Multivan|2.0 TDI,1.4 eHybrid")
for b, spec in {
    "Askam":"Fargo",
    "BMC":"Levend;Megastar",
    "Chery":"Taxim",
    "Chevrolet":"Astro;Express",
    "Chrysler":"Grand Voyager;Voyager",
    "DFM":"Succe;Rich",
    "DFSK":"C31;C32;C35",
    "Dodge":"Ram Van",
    "GAZ":"Gazelle;Sobol",
    "GMC":"Savana",
    "Lancia":"Phedra;Voyager",
    "MAN":"TGE",
    "Mazda":"E2000;E2200",
    "Pontiac":"Montana;Trans Sport",
    "Seat":"Inca",
    "Skoda":"Praktik",
    "Suzuki":"Carry;Super Carry",
    "Tenax":"V1",
}.items():
    V(b, spec)

# ---------------------------------------------------------------------
# 5) MOTORCYCLE
# ---------------------------------------------------------------------
MOTO = {}
def M(brand, spec): MOTO[brand] = parse_series(spec)

M("Honda", "Activa;Africa Twin|CRF1100L Adventure Sports;CB125F;CB250R;CB500F;CB500X;CB650R;CBR125R;CBR250R;CBR500R;CBR600RR;CBR650R;CBR1000RR;CRF250L;CRF300L;CRF1100L;Forza 250;Forza 350;Forza 750;Gold Wing;NC750X;PCX 125;Rebel 250;Rebel 500;SH125i;SH150i;Transalp XL750;X-ADV;Vision 110")
M("Yamaha", "Aerox 155;Bolt;Cygnus L;Delight;FJR1300;MT-07;MT-09;MT-10;NMAX 125;NMAX 155;R1;R25;R6;R7;Tenere 700;Tracer 7;Tracer 9;Tricity 300;XMAX 250;XMAX 300;XMAX 400;YZF-R125;YZF-R3")
M("BMW", "C 400 GT;C 400 X;C 600 Sport;C 650 GT;CE 02;CE 04;F 750 GS;F 800 GS;F 850 GS;F 900 R;F 900 XR;G 310 GS;G 310 R;K 1600 GT;K 1600 GTL;M 1000 R;M 1000 RR;R nineT;R 1250 GS;R 1250 RT;R 1300 GS;S 1000 R;S 1000 RR;S 1000 XR")
M("Bajaj", "Avenger 150;Avenger 220;Boxer 150;Dominar 250;Dominar 400;Pulsar NS125;Pulsar NS150;Pulsar NS160;Pulsar NS200;Pulsar RS200;Pulsar N250;Pulsar F250")
M("Kawasaki", "Eliminator 500;ER-5;ER-6F;ER-6N;KLE500;KLR650;Ninja 125;Ninja 250;Ninja 300;Ninja 400;Ninja 500;Ninja 650;Ninja ZX-6R;Ninja ZX-10R;Versys 650;Versys 1000;Vulcan S;Z125;Z250;Z300;Z400;Z500;Z650;Z900;Z1000")
M("Suzuki", "Address 110;Burgman 200;Burgman 400;Burgman 650;DL650 V-Strom;DL800 V-Strom;DL1000 V-Strom;GSX-8R;GSX-8S;GSX-R600;GSX-R750;GSX-R1000;GSX-S750;GSX-S1000;Hayabusa;Intruder;SV650")
M("Ducati", "Diavel;Hypermotard 698;Hypermotard 950;Monster 696;Monster 821;Monster 937;Multistrada 950;Multistrada V2;Multistrada V4;Panigale V2;Panigale V4;Scrambler;Streetfighter V2;Streetfighter V4;SuperSport 950")
M("KTM", "125 Duke;200 Duke;250 Duke;390 Duke;690 Duke;790 Duke;890 Duke;1290 Super Duke R;250 Adventure;390 Adventure;790 Adventure;890 Adventure;1290 Super Adventure;RC 125;RC 200;RC 250;RC 390")
M("Husqvarna", "Norden 901;Svartpilen 125;Svartpilen 250;Svartpilen 401;Svartpilen 801;Vitpilen 250;Vitpilen 401;701 Enduro;701 Supermoto")
M("Triumph", "Bonneville Bobber;Bonneville T100;Bonneville T120;Daytona 660;Rocket 3;Scrambler 400 X;Scrambler 900;Speed 400;Speed Triple;Street Triple;Tiger 660;Tiger 850 Sport;Tiger 900;Tiger 1200;Trident 660")
M("Harley-Davidson", "Breakout;CVO;Dyna;Fat Bob;Fat Boy;Heritage Classic;Iron 883;Low Rider;Nightster;Pan America;Road Glide;Road King;Softail;Sport Glide;Sportster S;Street Bob;Street Glide;V-Rod")
M("Aprilia", "Dorsoduro;RS 125;RS 457;RS 660;RSV4;RX 125;SR GT 200;SR Max;SX 125;Tuareg 660;Tuono 125;Tuono 660;Tuono V4")
M("Benelli", "125S;180S;302S;502C;752S;Imperiale 400;Leoncino 250;Leoncino 500;TNT 125;TNT 250;TRK 251;TRK 502;TRK 502 X;TRK 702;TRK 702 X")
M("CFmoto", "125NK;250CL-X;250NK;250SR;300NK;450CL-C;450MT;450NK;450SR;650GT;650MT;650NK;700CL-X;800MT;800NK;Papio;XO Papio")
M("Royal Enfield", "Bullet 350;Classic 350;Continental GT 650;Guerrilla 450;Himalayan 411;Himalayan 450;Hunter 350;Interceptor 650;Meteor 350;Scram 411;Shotgun 650;Super Meteor 650")
M("Vespa", "946;GTS 125;GTS 250;GTS 300;GTV 300;Primavera 50;Primavera 125;Primavera 150;Sprint 50;Sprint 125;Sprint 150")
M("Piaggio", "Beverly 300;Beverly 400;Liberty 50;Liberty 125;Medley 125;Medley 150;MP3 300;MP3 400;MP3 500;Typhoon;Zip")
M("Kymco", "Agility 50;Agility 125;AK 550;Downtown 250;Downtown 350;Like 125;People S 200;X-Town 250;X-Town 300;Xciting 400;Dink R 150")
M("SYM", "ADX 125;Cruisym 250;Cruisym 300;Fiddle 3;Jet 14;Joymax Z 250;Joymax Z 300;Maxsym 400;Maxsym TL 508;NH-T 200;Symphony ST 125")
M("Zontes", "125 G1;125 U;125 U1;125 X;250 R;310 M;350 D;350 E;350 GK;350 R;350 T;350 V;368 G")
M("Voge", "125 R;250 Rally;300 AC;300 DS;300 Rally;500 AC;500 DS;525 ACX;525 DSX;625 DSX;900 DSX")
M("QJ Motor", "ATR 125;Fort 350;LTR 150;MTX 125;SRK 125;SRK 250 R;SRK 400 RR;SRK 550;SRT 550;SRT 700;SRT 800;SVT 650")
M("RKS", "A250;Azure 50;Blade 250;Bitter 50;Dark Blue 50;Grace 202;Newlight;R250;RN 180;RT250;Titanic 150;Wildcat 125")
M("Mondial", "100 UAG;125 Drift L;125 MH Drift;125 ZNU;150 ZC;180 Z-One;250 MCT;250 Nevada;RX3i Evo;Wing 50;Virago 50")
M("Kuba", "Blueberry;Çita 100R;Çita 125R;Ege 50;RX9;Space 50;Superlight 125;X-Boss;XR 100")
M("Arora", "Beatrix 150;Freedom 50;Jaguar 200;Max-T 150;Mojito 125;Quantum 50;Special Alfa;Verano 50;ZRX 200")
M("TVS", "Apache RTR 160;Apache RTR 200;Apache RR 310;Jupiter 125;NTorq 125;Raider 125;Ronin 225")
M("Hero", "Dash 125;Duet 110;Hunk 150;Karizma XMR;Pleasure;Splendor;Xpulse 200;Xtreme 160R")
M("Indian", "Challenger;Chief;Chieftain;FTR;Roadmaster;Scout;Springfield;Super Chief")
M("Moto Guzzi", "California;Mandello V100;Stelvio;V7;V85 TT;V9 Bobber")
M("MV Agusta", "Brutale 800;Brutale 1000;Dragster 800;F3 800;Rush 1000;Superveloce 800;Turismo Veloce")
M("GasGas", "EC 250;EC 300;ES 700;MC 250F;SM 700")
M("Beta", "Alp 4.0;RR 125;RR 250;RR 300;RR 390;RR 430;RR 480;Xtrainer 300")
M("Fantic", "Caballero 125;Caballero 500;Caballero 700;XEF 250;XX 125")
M("Can-Am", "Ryker 600;Ryker 900;Spyder F3;Spyder RT")
M("NIU", "MQi GT;NQi GTS;RQi;UQi GT")
M("Super Soco", "CPx;TC;TC Max;TS Street Hunter;CUx")
M("Yuki", "Active 125;Casper S;Hammer 50;Legend 50;Matrix 125;Spitzer;Taro GP1")
M("Volta", "Apec APX5;RS5;RM5;VS1;VS2;VSM")
M("Peugeot", "Belville 200;Django 125;Kisbee 50;Metropolis 400;Pulsion 125;Tweet 125;XP400")
M("Lambretta", "G350;V125;V200;X300")
M("Royal Alloy", "GP 125;GP 300;TG 300")
M("Scomadi", "Technica 125;Turismo Leggera 125;Turismo Technica 200")
M("Brixton", "Cromwell 125;Cromwell 1200;Crossfire 500;Felsberg 125;Sunray 125")

# Fill some local/niche motorcycle brands as brand→series
for brand, spec in {
    "Apec":"APX5;APX6;APX7",
    "Altai":"F1 Max;Misk 50;Tank 50",
    "Apachi":"Alfa;Beta;XRS 125",
    "Asya":"AS 125;Ghost;Nostalji",
    "Benda Motor":"Chinchilla 300;Darkflag 500;LFC 700",
    "Bisan":"Lifan LF125;Roadstar",
    "Daelim":"Daystar 250;Roadwin 250;S3 Advance",
    "Derbi":"GPR 125;Senda;Terra 125",
    "Doohan":"iTank;Itango;Urban",
    "Falcon":"Attack 100;Freedom 250;Martian 150;Mexico 150",
    "Gilera":"DNA;Nexus 500;Runner",
    "Hyosung":"Aquila GV250;GT250R;GT650R;ST7",
    "Kanuni":"Breton 125;Caracal 200;GT 170;Seyhan 250",
    "Keeway":"Blueshark;K-Light 202;RKF 125;RKS 125;Superlight 200;Vieste 300",
    "Kral Motor":"Kr 25;Luna 50;Nirvana 150",
    "Lifan":"Discovery 150;Emisol 150;KPR 200;LF 150",
    "Malaguti":"Dune 125;Madison 300;Mission 125",
    "Motolux":"Africa Wolf;Efsane 50;Macchiato 125;Rossi 50",
    "Neco":"Alexone 125;Borsalino 125;Gpx 50",
    "Norton":"Commando 961;V4SV",
    "Polaris":"Slingshot",
    "Salcano":"Nova 125;Wolf 125",
    "Segway":"E110S;E125S;E300SE",
    "Stmax":"GF 910;Kobra;Lindy",
    "TGB":"Blade 550;X-Motion 250",
}.items():
    if brand not in MOTO:
        M(brand, spec)

# ---------------------------------------------------------------------
# 6) ELECTRIC NAVIGATION: brand→series; canonical category is retained
# ---------------------------------------------------------------------
ELECTRIC = {
    "Aion": parse_series("ES;Hyper GT;S;Y Plus"),
    "Audi": parse_series("A6 e-tron;e-tron GT;Q4 e-tron;Q6 e-tron;Q8 e-tron"),
    "BMW": parse_series("i3;i4;i5;i7;iX;iX1;iX2;iX3"),
    "BYD": parse_series("Atto 3;Dolphin;Han;Seal;Seal U;Tang"),
    "Citroen": parse_series("Ami;e-C3;e-C4;e-C4 X;e-Berlingo"),
    "Cupra": parse_series("Born;Tavascan"),
    "DS Automobiles": parse_series("DS 3 E-Tense;DS 4 E-Tense"),
    "Fiat": parse_series("500e;600e;E-Doblo;E-Ducato;Topolino"),
    "Ford": parse_series("Explorer EV;Capri EV;Mustang Mach-E;E-Transit;E-Transit Courier"),
    "Honda": parse_series("Honda e;e:Ny1"),
    "Hyundai": parse_series("Inster;Ioniq 5;Ioniq 6;Kona Electric"),
    "Jaguar": parse_series("I-Pace"),
    "Jeep": parse_series("Avenger Electric"),
    "Kia": parse_series("EV3;EV5;EV6;EV9;Niro EV"),
    "Leapmotor": parse_series("T03;C10;C11"),
    "Lexus": parse_series("RZ;UX 300e"),
    "Mercedes-Benz": parse_series("EQA;EQB;EQC;EQE;EQE SUV;EQS;EQS SUV;G 580 EQ"),
    "MG": parse_series("MG4;MG5 Electric;Marvel R;ZS EV"),
    "Mini": parse_series("Cooper Electric;Aceman;Countryman Electric"),
    "Nissan": parse_series("Leaf;Ariya;Townstar EV"),
    "Opel": parse_series("Corsa Electric;Astra Electric;Mokka Electric;Frontera Electric;Combo Electric;Vivaro Electric"),
    "Peugeot": parse_series("e-208;e-2008;e-3008;e-5008;e-Rifter;e-Partner;e-Expert"),
    "Polestar": parse_series("2;3;4"),
    "Porsche": parse_series("Taycan;Macan Electric"),
    "Renault": parse_series("Zoe;Megane E-Tech;Scenic E-Tech;Kangoo E-Tech;Master E-Tech"),
    "Seres": parse_series("Seres 3;Seres 5"),
    "Skoda": parse_series("Citigo-e;Enyaq;Elroq"),
    "Skywell": parse_series("ET5;HT-i"),
    "Smart": parse_series("#1;#3"),
    "Subaru": parse_series("Solterra"),
    "Tesla": parse_series("Model 3;Model S;Model X;Model Y;Cybertruck"),
    "TOGG": parse_series("T10X;T10F"),
    "Toyota": parse_series("bZ4X;Proace City Electric;Proace Electric"),
    "Volkswagen": parse_series("ID.3;ID.4;ID.5;ID.7;ID. Buzz"),
    "Volvo": parse_series("C40 Recharge;EX30;EX40;EX90"),
    "Voyah": parse_series("Free;Dream;Passion"),
    "XEV": parse_series("Yoyo"),
}

# ---------------------------------------------------------------------
# 7) COMMERCIAL / OTHER VEHICLE BRANCHES
# ---------------------------------------------------------------------
COMMERCIAL_SUB = {
    "Minibüs & Midibüs": {
        "Mercedes-Benz": parse_series("Sprinter|316 CDI,416 CDI,515 CDI;Vito;Tourismo"),
        "Ford": parse_series("Transit|14+1,16+1,19+1;Tourneo Custom"),
        "Iveco": parse_series("Daily|50C15,70C15;Mobi"),
        "Isuzu": parse_series("Novo;Turquoise;Visigo"),
        "Karsan": parse_series("Jest;Jest Electric;Atak;Star"),
        "Otokar": parse_series("Centro;Doruk;Navigo;Sultan"),
        "Temsa": parse_series("Prestij;MD9;Opalin"),
        "BMC": parse_series("Probus;Neocity"),
    },
    "Otobüs": {
        "Mercedes-Benz": parse_series("Intouro;Tourismo;Travego;Conecto;Citaro"),
        "MAN": parse_series("Lion's Coach;Lion's City;Neoplan Cityliner;Neoplan Tourliner"),
        "Setra": parse_series("S 415;S 416;S 417;S 431"),
        "Temsa": parse_series("Maraton;Safir;Tourmalin;Avenue"),
        "Otokar": parse_series("Kent;Doruk;Territo;Vectio"),
        "BMC": parse_series("Procity;Neocity"),
        "Isuzu": parse_series("Citiport;Citibus;Novociti"),
    },
    "Kamyon & Kamyonet": {
        "Mercedes-Benz": parse_series("Actros|1845,1848,1851,4142;Arocs|3242,3342,4145;Atego|1518,1524,1824;Axor|1840,2529,3240"),
        "Ford": parse_series("Cargo|1833,1838T,2533,3230,3542D;F-Max|500"),
        "MAN": parse_series("TGL|8.180,12.220;TGM|18.290,18.320;TGS|18.440,33.480,41.480;TGX|18.500,18.510"),
        "Volvo": parse_series("FL;FE;FM|330,410,450,500;FH|420,460,500,540"),
        "Scania": parse_series("P Serisi;G Serisi|G 410,G 450,G 500;R Serisi|R 450,R 500,R 540;S Serisi|S 500,S 540"),
        "Iveco": parse_series("Eurocargo;Stralis;S-Way;Trakker;Daily"),
        "DAF": parse_series("LF;CF;XF|XF 480,XF 530;XG;XG+"),
        "Renault Trucks": parse_series("D;C;K;T|T 460,T 480,T 520"),
        "BMC": parse_series("Fatih;Profesyonel;Pro 1142;Tuğra"),
        "Isuzu": parse_series("NPR|3D,5,10;NQR;NLR;NMR;FVR"),
        "Mitsubishi Fuso": parse_series("Canter|3C13,6C14,7C15,9C18"),
        "Hyundai": parse_series("HD35;HD65;HD75;Mighty"),
        "Askam": parse_series("AS 250;Desoto Fargo"),
    },
    "Çekici": {
        "Mercedes-Benz": parse_series("Actros|1842,1845,1848,1851;Axor|1840"),
        "Ford": parse_series("Cargo|1846T,1838T;F-Max|500"),
        "MAN": parse_series("TGS|18.440;TGX|18.480,18.500,18.510"),
        "Volvo": parse_series("FH|420,460,500,540;FM|410,450"),
        "Scania": parse_series("G|G 410,G 450;R|R 450,R 500,R 540;S|S 500,S 540"),
        "DAF": parse_series("CF|CF 450;XF|XF 480,XF 530;XG"),
        "Iveco": parse_series("Stralis|450,480;S-Way|490,570"),
        "Renault Trucks": parse_series("Premium;Magnum;T|T 460,T 480,T 520"),
    },
    "Dorse": {
        "Kässbohrer": parse_series("Tenteli;Damper;Lowbed;Frigo;Silobas;Konteyner Taşıyıcı"),
        "Krone": parse_series("Tenteli;Frigo;Konteyner Şasi"),
        "Schmitz Cargobull": parse_series("Tenteli;Frigo;Damper"),
        "Tırsan": parse_series("Tenteli;Frigo;Damper;Silobas;Lowbed"),
        "Öztreyler": parse_series("Damper;Lowbed;Tenteli"),
        "Serin": parse_series("Damper;Tenteli;Frigo"),
        "Nursan": parse_series("Damper;Tenteli"),
        "Kögel": parse_series("Tenteli;Frigo"),
    },
    "Römork": {
        "Aksoylu": parse_series("Tarım Römorku;Platform"),
        "Kässbohrer": parse_series("Ağır Nakliye Römorku"),
        "Tırsan": parse_series("Konteyner Römorku"),
        "Diğer": parse_series("Tek Dingil;Çift Dingil;Üç Dingil;Tekne Römorku;Araç Taşıma Römorku"),
    },
    "Karoser & Üst Yapı": {
        "Diğer": parse_series("Açık Kasa;Kapalı Kasa;Damper;Frigo Kasa;İtfaiye Üst Yapı;Kanal Açma;Mikser;Silobas;Su Tankeri;Vakumlu Kasa"),
    },
    "Oto Kurtarıcı & Taşıyıcı": {
        "Ford": parse_series("Transit Oto Kurtarıcı;Cargo Oto Kurtarıcı"),
        "Mercedes-Benz": parse_series("Sprinter Oto Kurtarıcı;Atego Oto Kurtarıcı"),
        "Iveco": parse_series("Daily Oto Kurtarıcı"),
        "Isuzu": parse_series("NPR Oto Kurtarıcı"),
        "Mitsubishi Fuso": parse_series("Canter Oto Kurtarıcı"),
        "Hyundai": parse_series("HD75 Oto Kurtarıcı"),
    },
    "Ticari Hat & Ticari Plaka": {
        "Diğer": parse_series("Taksi Plakası;Minibüs Hattı;Servis Plakası;Otobüs Hattı;Dolmuş Hattı"),
    },
}

ATV = {
    "Can-Am": parse_series("Outlander 450;Outlander 650;Outlander 850;Outlander 1000;Renegade 570;Renegade 1000"),
    "CFmoto": parse_series("CForce 450;CForce 520;CForce 625;CForce 850;CForce 1000"),
    "Polaris": parse_series("Sportsman 570;Sportsman 850;Scrambler 850;Scrambler XP 1000"),
    "Yamaha": parse_series("Grizzly 700;Kodiak 450;Kodiak 700;Raptor 700;YFZ450R"),
    "Suzuki": parse_series("KingQuad 400;KingQuad 500;KingQuad 750"),
    "Kawasaki": parse_series("Brute Force 300;Brute Force 750;KFX 90"),
    "Segway": parse_series("Snarler AT5;Snarler AT6;Snarler AT10"),
    "TGB": parse_series("Blade 550;Blade 600;Blade 1000;Target 600"),
    "Kymco": parse_series("MXU 300;MXU 550;MXU 700"),
    "Linhai": parse_series("M150;M550;M750"),
    "Arora": parse_series("Atak 200;Sahara 250"),
    "Kuba": parse_series("Eland 200;Promax 250"),
}

UTV = {
    "Can-Am": parse_series("Commander 700;Commander 1000;Defender HD7;Defender HD9;Defender HD10;Maverick X3"),
    "CFmoto": parse_series("UForce 600;UForce 1000;ZForce 950;ZForce 1000"),
    "Polaris": parse_series("General 1000;Ranger 570;Ranger 1000;RZR 570;RZR 1000;RZR Pro R"),
    "Segway": parse_series("Fugleman UT6;Fugleman UT10;Villain SX10"),
    "Kawasaki": parse_series("Mule Pro;Teryx KRX 1000"),
    "Yamaha": parse_series("Viking;Wolverine;YXZ1000R"),
    "John Deere": parse_series("Gator XUV"),
    "Kymco": parse_series("UXV 450;UXV 700"),
}

CARAVAN_SUB = {
    "Motokaravan": {
        "Adria": parse_series("Twin;Supersonic;Matrix"),
        "Benimar": parse_series("Mileo;Tessoro"),
        "Bürstner": parse_series("Lyseo;Elegance;Nexxo"),
        "Carado": parse_series("T Serisi;I Serisi;Vlow"),
        "Dethleffs": parse_series("Globebus;Just 90;Trend"),
        "Hymer": parse_series("B-Class;Exsis;Grand Canyon"),
        "Knaus": parse_series("Boxstar;Sky TI;Van TI"),
        "Laika": parse_series("Kosmo;Kreos;Ecocip"),
        "Roller Team": parse_series("Kronos;Zefiro"),
        "Sunlight": parse_series("Cliff;T Serisi"),
        "Volkswagen": parse_series("California"),
        "Mercedes-Benz": parse_series("Marco Polo;Sprinter Dönüşüm"),
        "Ford": parse_series("Nugget;Transit Dönüşüm"),
        "Fiat": parse_series("Ducato Dönüşüm"),
    },
    "Çekme Karavan": {
        "Adria": parse_series("Adora;Altea;Aviva"),
        "Bürstner": parse_series("Averso;Premio"),
        "Dethleffs": parse_series("Aero;Camper;Nomad"),
        "Eriba": parse_series("Feeling;Nova;Touring"),
        "Hobby": parse_series("De Luxe;Excellent;Prestige"),
        "Knaus": parse_series("Deseo;Sport;Südwind"),
        "Tabbert": parse_series("Da Vinci;Puccini;Vivaldi"),
        "Weinsberg": parse_series("CaraOne;CaraCito"),
        "Başoğlu": parse_series("Caretta 1500;Caretta Uncle"),
        "Saly": parse_series("Carabinata;Sal 400"),
    },
    "Campervan": {
        "Volkswagen": parse_series("Transporter Camper;Crafter Camper"),
        "Mercedes-Benz": parse_series("Vito Camper;Sprinter Camper"),
        "Ford": parse_series("Transit Custom Camper;Transit Camper"),
        "Fiat": parse_series("Doblo Camper;Ducato Camper"),
        "Renault": parse_series("Trafic Camper;Master Camper"),
        "Peugeot": parse_series("Expert Camper;Boxer Camper"),
        "Citroen": parse_series("Jumpy Camper;Jumper Camper"),
    },
    "Karavan Projesi": {"Diğer": parse_series("Boş Panelvan;Yarım Kalmış Proje;Şasi Üstü Proje")},
}

SEA_SUB = {
    "Motorlu Tekne": {
        "Bayliner": parse_series("Element;VR5;VR6;Ciera"),
        "Jeanneau": parse_series("Cap Camarat;Merry Fisher;Leader"),
        "Beneteau": parse_series("Antares;Flyer;Gran Turismo"),
        "Quicksilver": parse_series("Activ 505;Activ 605;Activ 755"),
        "Sea Ray": parse_series("SPX;Sundancer;SLX"),
        "Princess": parse_series("V40;V50;F50;Y72"),
        "Azimut": parse_series("Atlantis;Fly;Magellano"),
        "Fairline": parse_series("Targa;Phantom;Squadron"),
    },
    "Yelkenli": {
        "Beneteau": parse_series("Oceanis;First"),
        "Jeanneau": parse_series("Sun Odyssey;Sun Fast"),
        "Bavaria": parse_series("Cruiser;C-Line;Vision"),
        "Dufour": parse_series("Dufour 360;Dufour 430;Dufour 470"),
        "Hanse": parse_series("Hanse 315;Hanse 418;Hanse 460"),
    },
    "Şişme Bot": {
        "Zodiac": parse_series("Cadet;Medline;Pro"),
        "Highfield": parse_series("Classic;Sport;Patrol"),
        "Lomac": parse_series("Adrenalina;GranTurismo"),
        "Brig": parse_series("Eagle;Falcon;Navigator"),
    },
    "Jet Ski": {
        "Sea-Doo": parse_series("Spark;GTI;GTR;RXP-X;RXT-X"),
        "Yamaha": parse_series("EX;FX;GP;VX"),
        "Kawasaki": parse_series("Jet Ski STX;Ultra 160;Ultra 310"),
    },
    "Deniz Motoru": {
        "Mercury": parse_series("FourStroke;Pro XS;Verado"),
        "Yamaha": parse_series("F Serisi;V MAX SHO"),
        "Honda": parse_series("BF Serisi"),
        "Suzuki": parse_series("DF Serisi"),
        "Evinrude": parse_series("E-TEC"),
        "Tohatsu": parse_series("MFS Serisi"),
    },
}

AIR_SUB = {
    "Uçak": {
        "Cessna": parse_series("150;152;172;182;206;Citation"),
        "Piper": parse_series("PA-28 Cherokee;PA-34 Seneca;PA-46 Malibu"),
        "Beechcraft": parse_series("Baron;Bonanza;King Air"),
        "Cirrus": parse_series("SR20;SR22;Vision Jet"),
        "Tecnam": parse_series("P2002;P2006T;P2010"),
    },
    "Helikopter": {
        "Robinson": parse_series("R22;R44;R66"),
        "Airbus Helicopters": parse_series("H125;H130;H135"),
        "Bell": parse_series("206;407;429"),
        "Leonardo": parse_series("AW109;AW119;AW139"),
    },
    "Ultralight": {
        "Aeroprakt": parse_series("A22;A32"),
        "Flight Design": parse_series("CTLS;F2"),
        "Pipistrel": parse_series("Alpha Trainer;Virus SW;Velis Electro"),
        "Remos": parse_series("GX"),
    },
    "Planör": {
        "Schempp-Hirth": parse_series("Arcus;Discus;Ventus"),
        "Schleicher": parse_series("ASK 21;ASG 29;ASH 31"),
        "DG Flugzeugbau": parse_series("DG-1000;LS8"),
    },
}

# ---------------------------------------------------------------------
# 8) TREE ASSEMBLY
# ---------------------------------------------------------------------
SOURCES = {
    "sahibinden_main": "https://www.sahibinden.com/kategori/vasita",
    "sahibinden_auto": "https://www.sahibinden.com/kategori/otomobil",
    "sahibinden_suv": "https://www.sahibinden.com/kategori/arazi-suv-pickup",
    "sahibinden_moto": "https://www.sahibinden.com/kategori/motosiklet",
    "sahibinden_minivan": "https://www.sahibinden.com/kategori/minivan-panelvan",
    "sahibinden_commercial": "https://www.sahibinden.com/kategori/ticari-araclar",
    "cardata": "https://cardata.wiki/",
}

def make_node(name, level, source, status, children=None, notes=None, canonical_ref=None):
    n = {
        "name": name,
        "slug": slugify(name),
        "level": level,
        "source": source,
        "status": status,
        "extractedAt": NOW,
        "children": children or [],
    }
    if notes:
        n["notes"] = notes
    if canonical_ref:
        n["canonicalRef"] = canonical_ref
    return n

def catalog_to_brand_nodes(catalog, category_source, base_status="CURATED_REVIEW"):
    result = []
    for brand in sorted(catalog, key=lambda x: x.casefold()):
        series_map = catalog.get(brand, {})
        series_nodes = []
        for series_name in sorted(series_map, key=lambda x: x.casefold()):
            variants = series_map[series_name]
            variant_nodes = [
                make_node(v, "MODEL_VARIANT", "curated-market-v1", "CURATED_REVIEW")
                for v in variants
            ]
            series_nodes.append(
                make_node(series_name, "SERIES", "curated-market-v1", base_status, variant_nodes)
            )
        result.append(
            make_node(
                brand, "BRAND", category_source, "PUBLIC_NAV_VERIFIED",
                series_nodes,
                notes=None if series_nodes else "Marka doğrulandı; seri/model dalı sonraki veri doğrulamasına bırakıldı."
            )
        )
    return result

def merge_catalog_with_brand_list(brands, catalog):
    return {b: catalog.get(b, {}) for b in brands}

auto_catalog = merge_catalog_with_brand_list(automobile_brands, AUTO)
suv_catalog = merge_catalog_with_brand_list(suv_brands, SUV)
moto_catalog = merge_catalog_with_brand_list(motorcycle_brands, MOTO)
minivan_catalog = merge_catalog_with_brand_list(minivan_brands, MINIVAN)
electric_catalog = merge_catalog_with_brand_list(electric_brands, ELECTRIC)

root_children = []

root_children.append(make_node(
    "Otomobil", "VEHICLE_CATEGORY", SOURCES["sahibinden_auto"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(auto_catalog, SOURCES["sahibinden_auto"])
))
root_children.append(make_node(
    "Arazi, SUV & Pickup", "VEHICLE_CATEGORY", SOURCES["sahibinden_suv"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(suv_catalog, SOURCES["sahibinden_suv"]),
    notes="Arazi/SUV/Crossover/Pickup ara düğümü yoktur; doğrudan marka gelir."
))
root_children.append(make_node(
    "Elektrikli Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(electric_catalog, SOURCES["sahibinden_main"]),
    notes="Navigasyon dalıdır. Kanonik ilan kategorisi Otomobil/Arazi SUV Pickup/Minivan olabilir; yakıt türü ELEKTRİK filtresiyle ilişkilendirilmelidir."
))
root_children.append(make_node(
    "Motosiklet", "VEHICLE_CATEGORY", SOURCES["sahibinden_moto"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(moto_catalog, SOURCES["sahibinden_moto"])
))
root_children.append(make_node(
    "Minivan & Panelvan", "VEHICLE_CATEGORY", SOURCES["sahibinden_minivan"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(minivan_catalog, SOURCES["sahibinden_minivan"])
))

commercial_children = []
for sub, cat in COMMERCIAL_SUB.items():
    commercial_children.append(make_node(
        sub, "SUBCATEGORY", SOURCES["sahibinden_commercial"], "PUBLIC_NAV_VERIFIED",
        catalog_to_brand_nodes(cat, SOURCES["sahibinden_commercial"])
    ))
root_children.append(make_node(
    "Ticari Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_commercial"], "PUBLIC_NAV_VERIFIED",
    commercial_children
))

# Virtual / transactional branches
root_children.append(make_node(
    "Kiralık Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED", [],
    notes="Satış kataloğundan bağımsız kiralama görünümüdür; araç marka-seri ağacı kanonik Vasıta kataloğuna referans vermelidir.",
    canonical_ref="Vasıta/Otomobil + Vasıta/Arazi, SUV & Pickup + Vasıta/Minivan & Panelvan"
))

sea_children = []
for sub, cat in SEA_SUB.items():
    sea_children.append(make_node(sub, "SUBCATEGORY", "curated-market-v1", "CURATED_REVIEW",
                                  catalog_to_brand_nodes(cat, "curated-market-v1")))
root_children.append(make_node("Deniz Araçları", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"],
                               "PUBLIC_NAV_VERIFIED", sea_children))

root_children.append(make_node(
    "Hasarlı Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED", [],
    notes="Hasar durumu görünümüdür; marka-seri ağacı kanonik araç dallarından gelmelidir.",
    canonical_ref="Vasıta kanonik araç kataloğu + damageStatus"
))

caravan_children = []
for sub, cat in CARAVAN_SUB.items():
    caravan_children.append(make_node(sub, "SUBCATEGORY", "curated-market-v1", "CURATED_REVIEW",
                                      catalog_to_brand_nodes(cat, "curated-market-v1")))
root_children.append(make_node("Karavan", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"],
                               "PUBLIC_NAV_VERIFIED", caravan_children))

root_children.append(make_node(
    "Klasik Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED", [],
    notes="Klasik statüsü yıl/özellik filtresidir; kanonik Otomobil/Arazi ağacına referans verir.",
    canonical_ref="Vasıta/Otomobil + Vasıta/Arazi, SUV & Pickup + classicStatus"
))

air_children = []
for sub, cat in AIR_SUB.items():
    air_children.append(make_node(sub, "SUBCATEGORY", "curated-market-v1", "CURATED_REVIEW",
                                  catalog_to_brand_nodes(cat, "curated-market-v1")))
root_children.append(make_node("Hava Araçları", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"],
                               "PUBLIC_NAV_VERIFIED", air_children))

root_children.append(make_node(
    "ATV", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(ATV, "curated-market-v1")
))
root_children.append(make_node(
    "UTV", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED",
    catalog_to_brand_nodes(UTV, "curated-market-v1")
))
root_children.append(make_node(
    "Engelli Plakalı Araçlar", "VEHICLE_CATEGORY", SOURCES["sahibinden_main"], "PUBLIC_NAV_VERIFIED", [],
    notes="Plaka/uygunluk görünümüdür; kanonik araç kataloğuna referans verir.",
    canonical_ref="Vasıta kanonik araç kataloğu + disabilityPlateEligibility"
))

tree = {
    "metadata": {
        "title": "TeklifBu Vasıta Kategori, Marka ve Alt Ağaçları",
        "version": "2026.08-curated-v1",
        "generatedAt": NOW,
        "exactSahibindenClone": False,
        "scope": "15 ana Vasıta kategorisi; kamuya açık marka navigasyonu; Türkiye pazarı için genişletilmiş seri ve yaygın model/versiyon etiketleri.",
        "qualityPolicy": {
            "PUBLIC_NAV_VERIFIED": "Kamuya açık kategori/navigasyon seviyesinde doğrulandı.",
            "CURATED_REVIEW": "Pazar bilgisi ve açık kaynak çapraz kontrolüyle hazırlandı; üretim importundan önce satır bazında doğrulanmalıdır.",
        },
        "important": "Bu veri Sahibinden'in özel/veritabanı içeriğinin birebir kopyası değildir. Erişilebilen kamuya açık navigasyon adları ile üretim odaklı, kaynak/status alanlı bir başlangıç kataloğudur.",
        "sources": list(SOURCES.values()),
    },
    "name": "Vasıta",
    "slug": "vasita",
    "level": "ROOT",
    "children": root_children,
}

# ---------------------------------------------------------------------
# 9) FLATTEN
# ---------------------------------------------------------------------
flat = []
def walk(node, path=None):
    path = path or []
    current_path = path + [node.get("name", "")]
    if node.get("level") != "ROOT":
        names = current_path[1:] if current_path and current_path[0] == "Vasıta" else current_path
        row = {
            "category": names[0] if len(names) > 0 else "",
            "subcategory": names[1] if len(names) > 1 and node.get("level") == "SUBCATEGORY" else "",
            "brand": "",
            "series": "",
            "modelVariant": "",
            "level": node.get("level", ""),
            "name": node.get("name", ""),
            "slug": node.get("slug", ""),
            "fullPath": " > ".join(current_path),
            "source": node.get("source", ""),
            "status": node.get("status", ""),
            "notes": node.get("notes", ""),
            "canonicalRef": node.get("canonicalRef", ""),
        }
        # Determine columns from ancestor level names
        # Re-traverse current path with level context through a helper stack below.
        flat.append(row)
    for child in node.get("children", []):
        walk(child, current_path)

# Better level-aware flatten
flat = []
def walk2(node, ctx):
    new = dict(ctx)
    level = node.get("level")
    name = node.get("name")
    if level == "VEHICLE_CATEGORY":
        new["category"] = name
        new["subcategory"] = ""
        new["brand"] = ""
        new["series"] = ""
        new["modelVariant"] = ""
    elif level == "SUBCATEGORY":
        new["subcategory"] = name
        new["brand"] = ""
        new["series"] = ""
        new["modelVariant"] = ""
    elif level == "BRAND":
        new["brand"] = name
        new["series"] = ""
        new["modelVariant"] = ""
    elif level == "SERIES":
        new["series"] = name
        new["modelVariant"] = ""
    elif level == "MODEL_VARIANT":
        new["modelVariant"] = name
    path_parts = [p for p in [
        "Vasıta",
        new.get("category",""),
        new.get("subcategory",""),
        new.get("brand",""),
        new.get("series",""),
        new.get("modelVariant",""),
    ] if p]
    if level != "ROOT":
        flat.append({
            "category": new.get("category",""),
            "subcategory": new.get("subcategory",""),
            "brand": new.get("brand",""),
            "series": new.get("series",""),
            "modelVariant": new.get("modelVariant",""),
            "level": level,
            "name": name,
            "slug": node.get("slug",""),
            "fullPath": " > ".join(path_parts),
            "source": node.get("source",""),
            "status": node.get("status",""),
            "notes": node.get("notes",""),
            "canonicalRef": node.get("canonicalRef",""),
        })
    for child in node.get("children", []):
        walk2(child, new)

walk2(tree, {})

# Deduplicate exact paths
dedup = {}
for r in flat:
    dedup[r["fullPath"]] = r
flat = list(dedup.values())

# Summary
level_counts = Counter(r["level"] for r in flat)
status_counts = Counter(r["status"] for r in flat)
category_counts = defaultdict(Counter)
for r in flat:
    category_counts[r["category"]][r["level"]] += 1

summary = {
    "generatedAt": NOW,
    "version": tree["metadata"]["version"],
    "exactSahibindenClone": False,
    "levelCounts": dict(level_counts),
    "statusCounts": dict(status_counts),
    "totalRows": len(flat),
    "categoryCounts": {k: dict(v) for k, v in category_counts.items()},
    "emptyBrandBranches": [
        r["fullPath"] for r in flat if r["level"] == "BRAND"
        and not any(x["fullPath"].startswith(r["fullPath"] + " > ") for x in flat)
    ],
}

# ---------------------------------------------------------------------
# 10) WRITE JSON / CSV / MD / REVIEW
# ---------------------------------------------------------------------
json_path = OUT / "teklifbu_vasita_kategori_marka_alt_agaclari.json"
csv_path = OUT / "teklifbu_vasita_kategori_marka_alt_agaclari.csv"
md_path = OUT / "teklifbu_vasita_kategori_marka_alt_agaclari.md"
summary_path = OUT / "teklifbu_vasita_katalog_ozet.json"
review_path = OUT / "teklifbu_vasita_dogrulama_gerekenler.csv"

json_path.write_text(json.dumps(tree, ensure_ascii=False, indent=2), encoding="utf-8")
summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

cols = ["category","subcategory","brand","series","modelVariant","level","name","slug",
        "fullPath","source","status","notes","canonicalRef"]
with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(flat)

review_rows = [r for r in flat if r["status"] == "CURATED_REVIEW" or
               (r["level"] == "BRAND" and not any(x["fullPath"].startswith(r["fullPath"] + " > ") for x in flat))]
with review_path.open("w", newline="", encoding="utf-8-sig") as f:
    w = csv.DictWriter(f, fieldnames=cols)
    w.writeheader()
    w.writerows(review_rows)

# Markdown: readable, but cap variants per series visually only; full data remains in JSON/CSV.
lines = [
    "# TeklifBu Vasıta Kategori, Marka ve Alt Ağaçları",
    "",
    f"- Sürüm: `{tree['metadata']['version']}`",
    f"- Üretim: `{NOW}`",
    f"- Toplam düz kayıt: **{len(flat):,}**",
    f"- Marka düğümü: **{level_counts.get('BRAND',0):,}**",
    f"- Seri düğümü: **{level_counts.get('SERIES',0):,}**",
    f"- Model/versiyon düğümü: **{level_counts.get('MODEL_VARIANT',0):,}**",
    "",
    "> Not: Bu dosya erişilebilen kamuya açık navigasyon verileriyle hazırlanmış üretim odaklı bir başlangıç kataloğudur; Sahibinden özel veritabanının birebir kopyası değildir.",
    ""
]
for catnode in root_children:
    lines.append(f"## {catnode['name']}")
    if catnode.get("notes"):
        lines.append(f"> {catnode['notes']}")
    for child in catnode.get("children", []):
        if child["level"] == "SUBCATEGORY":
            lines.append(f"### {child['name']}")
            brands = child.get("children", [])
        else:
            brands = catnode.get("children", [])
            # only once
            if child is not catnode.get("children", [None])[0]:
                continue
        for brand_node in brands:
            lines.append(f"#### {brand_node['name']}")
            for series_node in brand_node.get("children", []):
                variants = [v["name"] for v in series_node.get("children", [])]
                if variants:
                    lines.append(f"- **{series_node['name']}** → " + ", ".join(variants))
                else:
                    lines.append(f"- {series_node['name']}")
        if child["level"] != "SUBCATEGORY":
            break
    lines.append("")
md_path.write_text("\n".join(lines), encoding="utf-8")

print(json.dumps({
    "files": [str(json_path), str(csv_path), str(md_path), str(summary_path), str(review_path)],
    "totalRows": len(flat),
    "levels": dict(level_counts),
    "statuses": dict(status_counts),
    "emptyBrandBranches": len(summary["emptyBrandBranches"]),
}, ensure_ascii=False, indent=2))
