import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {Record<string, string[]>} */
const districtsByCity = {
  Adana: ["Aladağ", "Ceyhan", "Çukurova", "Feke", "İmamoğlu", "Karaisalı", "Karataş", "Kozan", "Pozantı", "Saimbeyli", "Sarıçam", "Seyhan", "Tufanbeyli", "Yumurtalık", "Yüreğir"],
  Adıyaman: ["Besni", "Çelikhan", "Gerger", "Gölbaşı", "Kahta", "Merkez", "Samsat", "Sincik", "Tut"],
  Afyonkarahisar: ["Başmakçı", "Bayat", "Bolvadin", "Çay", "Çobanlar", "Dazkırı", "Dinar", "Emirdağ", "Evciler", "Hocalar", "İhsaniye", "İscehisar", "Kızılören", "Merkez", "Sandıklı", "Sinanpaşa", "Sultandağı", "Şuhut"],
  Ağrı: ["Diyadin", "Doğubayazıt", "Eleşkirt", "Hamur", "Merkez", "Patnos", "Taşlıçay", "Tutak"],
  Amasya: ["Göynücek", "Gümüşhacıköy", "Hamamözü", "Merkez", "Merzifon", "Suluova", "Taşova"],
  Ankara: ["Akyurt", "Altındağ", "Ayaş", "Bala", "Beypazarı", "Çamlıdere", "Çankaya", "Çubuk", "Elmadağ", "Etimesgut", "Evren", "Gölbaşı", "Güdül", "Haymana", "Kahramankazan", "Kalecik", "Keçiören", "Kızılcahamam", "Mamak", "Nallıhan", "Polatlı", "Pursaklar", "Sincan", "Şereflikoçhisar", "Yenimahalle"],
  Antalya: ["Akseki", "Aksu", "Alanya", "Demre", "Döşemealtı", "Elmalı", "Finike", "Gazipaşa", "Gündoğmuş", "İbradı", "Kaş", "Kemer", "Kepez", "Konyaaltı", "Korkuteli", "Kumluca", "Manavgat", "Muratpaşa", "Serik"],
  Artvin: ["Ardanuç", "Arhavi", "Borçka", "Hopa", "Kemalpaşa", "Merkez", "Murgul", "Şavşat", "Yusufeli"],
  Aydın: ["Bozdoğan", "Buharkent", "Çine", "Didim", "Efeler", "Germencik", "İncirliova", "Karacasu", "Karpuzlu", "Koçarlı", "Köşk", "Kuşadası", "Kuyucak", "Nazilli", "Söke", "Sultanhisar", "Yenipazar"],
  Balıkesir: ["Altıeylül", "Ayvalık", "Balya", "Bandırma", "Bigadiç", "Burhaniye", "Dursunbey", "Edremit", "Erdek", "Gömeç", "Gönen", "Havran", "İvrindi", "Karesi", "Kepsut", "Manyas", "Marmara", "Savaştepe", "Sındırgı", "Susurluk"],
  Bilecik: ["Bozüyük", "Gölpazarı", "İnhisar", "Merkez", "Osmaneli", "Pazaryeri", "Söğüt", "Yenipazar"],
  Bingöl: ["Adaklı", "Genç", "Karlıova", "Kiğı", "Merkez", "Solhan", "Yayladere", "Yedisu"],
  Bitlis: ["Adilcevaz", "Ahlat", "Güroymak", "Hizan", "Merkez", "Mutki", "Tatvan"],
  Bolu: ["Dörtdivan", "Gerede", "Göynük", "Kıbrıscık", "Mengen", "Merkez", "Mudurnu", "Seben", "Yeniçağa"],
  Burdur: ["Ağlasun", "Altınyayla", "Bucak", "Çavdır", "Çeltikçi", "Gölhisar", "Karamanlı", "Kemer", "Merkez", "Tefenni", "Yeşilova"],
  Bursa: ["Büyükorhan", "Gemlik", "Gürsu", "Harmancık", "İnegöl", "İznik", "Karacabey", "Keles", "Kestel", "Mudanya", "Mustafakemalpaşa", "Nilüfer", "Orhaneli", "Orhangazi", "Osmangazi", "Yenişehir", "Yıldırım"],
  Çanakkale: ["Ayvacık", "Bayramiç", "Biga", "Bozcaada", "Çan", "Eceabat", "Ezine", "Gelibolu", "Gökçeada", "Lapseki", "Merkez", "Yenice"],
  Çankırı: ["Atkaracalar", "Bayramören", "Çerkeş", "Eldivan", "Ilgaz", "Kızılırmak", "Korgun", "Kurşunlu", "Merkez", "Orta", "Şabanözü", "Yapraklı"],
  Çorum: ["Alaca", "Bayat", "Boğazkale", "Dodurga", "İskilip", "Kargı", "Laçin", "Mecitözü", "Merkez", "Oğuzlar", "Ortaköy", "Osmancık", "Sungurlu", "Uğurludağ"],
  Denizli: ["Acıpayam", "Babadağ", "Baklan", "Bekilli", "Beyağaç", "Bozkurt", "Buldan", "Çal", "Çameli", "Çardak", "Çivril", "Güney", "Honaz", "Kale", "Merkezefendi", "Pamukkale", "Sarayköy", "Serinhisar", "Tavas"],
  Diyarbakır: ["Bağlar", "Bismil", "Çermik", "Çınar", "Çüngüş", "Dicle", "Eğil", "Ergani", "Hani", "Hazro", "Kayapınar", "Kocaköy", "Kulp", "Lice", "Silvan", "Sur", "Yenişehir"],
  Edirne: ["Enez", "Havsa", "İpsala", "Keşan", "Lalapaşa", "Meriç", "Merkez", "Süloğlu", "Uzunköprü"],
  Elazığ: ["Ağın", "Alacakaya", "Arıcak", "Baskil", "Karakoçan", "Keban", "Kovancılar", "Maden", "Merkez", "Palu", "Sivrice"],
  Erzincan: ["Çayırlı", "İliç", "Kemah", "Kemaliye", "Merkez", "Otlukbeli", "Refahiye", "Tercan", "Üzümlü"],
  Erzurum: ["Aşkale", "Aziziye", "Çat", "Hınıs", "Horasan", "İspir", "Karaçoban", "Karayazı", "Köprüköy", "Narman", "Oltu", "Olur", "Palandöken", "Pasinler", "Pazaryolu", "Şenkaya", "Tekman", "Tortum", "Uzundere", "Yakutiye"],
  Eskişehir: ["Alpu", "Beylikova", "Çifteler", "Günyüzü", "Han", "İnönü", "Mahmudiye", "Mihalgazi", "Mihalıççık", "Odunpazarı", "Sarıcakaya", "Seyitgazi", "Sivrihisar", "Tepebaşı"],
  Gaziantep: ["Araban", "İslahiye", "Karkamış", "Nizip", "Nurdağı", "Oğuzeli", "Şahinbey", "Şehitkamil", "Yavuzeli"],
  Giresun: ["Alucra", "Bulancak", "Çamoluk", "Çanakçı", "Dereli", "Doğankent", "Espiye", "Eynesil", "Görele", "Güce", "Keşap", "Merkez", "Piraziz", "Şebinkarahisar", "Tirebolu", "Yağlıdere"],
  Gümüşhane: ["Kelkit", "Köse", "Kürtün", "Merkez", "Şiran", "Torul"],
  Hakkari: ["Çukurca", "Derecik", "Merkez", "Şemdinli", "Yüksekova"],
  Hatay: ["Altınözü", "Antakya", "Arsuz", "Belen", "Defne", "Dörtyol", "Erzin", "Hassa", "İskenderun", "Kırıkhan", "Kumlu", "Payas", "Reyhanlı", "Samandağ", "Yayladağı"],
  Isparta: ["Aksu", "Atabey", "Eğirdir", "Gelendost", "Gönen", "Keçiborlu", "Merkez", "Senirkent", "Sütçüler", "Şarkikaraağaç", "Uluborlu", "Yalvaç", "Yenişarbademli"],
  Mersin: ["Akdeniz", "Anamur", "Aydıncık", "Bozyazı", "Çamlıyayla", "Erdemli", "Gülnar", "Mezitli", "Mut", "Silifke", "Tarsus", "Toroslar", "Yenişehir"],
  İstanbul: ["Adalar", "Arnavutköy", "Ataşehir", "Avcılar", "Bağcılar", "Bahçelievler", "Bakırköy", "Başakşehir", "Bayrampaşa", "Beşiktaş", "Beykoz", "Beylikdüzü", "Beyoğlu", "Büyükçekmece", "Çatalca", "Çekmeköy", "Esenler", "Esenyurt", "Eyüpsultan", "Fatih", "Gaziosmanpaşa", "Güngören", "Kadıköy", "Kağıthane", "Kartal", "Küçükçekmece", "Maltepe", "Pendik", "Sancaktepe", "Sarıyer", "Silivri", "Sultanbeyli", "Sultangazi", "Şile", "Şişli", "Tuzla", "Ümraniye", "Üsküdar", "Zeytinburnu"],
  İzmir: ["Aliağa", "Balçova", "Bayındır", "Bayraklı", "Bergama", "Beydağ", "Bornova", "Buca", "Çeşme", "Çiğli", "Dikili", "Foça", "Gaziemir", "Güzelbahçe", "Karabağlar", "Karaburun", "Karşıyaka", "Kemalpaşa", "Kınık", "Kiraz", "Konak", "Menderes", "Menemen", "Narlıdere", "Ödemiş", "Seferihisar", "Selçuk", "Tire", "Torbalı", "Urla"],
  Kars: ["Akyaka", "Arpaçay", "Digor", "Kağızman", "Merkez", "Sarıkamış", "Selim", "Susuz"],
  Kastamonu: ["Abana", "Ağlı", "Araç", "Azdavay", "Bozkurt", "Cide", "Çatalzeytin", "Daday", "Devrekani", "Doğanyurt", "Hanönü", "İhsangazi", "İnebolu", "Küre", "Merkez", "Pınarbaşı", "Seydiler", "Şenpazar", "Taşköprü", "Tosya"],
  Kayseri: ["Akkışla", "Bünyan", "Develi", "Felahiye", "Hacılar", "İncesu", "Kocasinan", "Melikgazi", "Özvatan", "Pınarbaşı", "Sarıoğlan", "Sarız", "Talas", "Tomarza", "Yahyalı", "Yeşilhisar"],
  Kırklareli: ["Babaeski", "Demirköy", "Kofçaz", "Lüleburgaz", "Merkez", "Pehlivanköy", "Pınarhisar", "Vize"],
  Kırşehir: ["Akçakent", "Akpınar", "Boztepe", "Çiçekdağı", "Kaman", "Merkez", "Mucur"],
  Kocaeli: ["Başiskele", "Çayırova", "Darıca", "Derince", "Dilovası", "Gebze", "Gölcük", "İzmit", "Kandıra", "Karamürsel", "Kartepe", "Körfez"],
  Konya: ["Ahırlı", "Akören", "Akşehir", "Altınekin", "Beyşehir", "Bozkır", "Cihanbeyli", "Çeltik", "Çumra", "Derbent", "Derebucak", "Doğanhisar", "Emirgazi", "Ereğli", "Güneysınır", "Hadim", "Halkapınar", "Hüyük", "Ilgın", "Kadınhanı", "Karapınar", "Karatay", "Kulu", "Meram", "Sarayönü", "Selçuklu", "Seydişehir", "Taşkent", "Tuzlukçu", "Yalıhüyük", "Yunak"],
  Kütahya: ["Altıntaş", "Aslanapa", "Çavdarhisar", "Domaniç", "Dumlupınar", "Emet", "Gediz", "Hisarcık", "Merkez", "Pazarlar", "Simav", "Şaphane", "Tavşanlı"],
  Malatya: ["Akçadağ", "Arapgir", "Arguvan", "Battalgazi", "Darende", "Doğanşehir", "Doğanyol", "Hekimhan", "Kale", "Kuluncak", "Pütürge", "Yazıhan", "Yeşilyurt"],
  Manisa: ["Ahmetli", "Akhisar", "Alaşehir", "Demirci", "Gölmarmara", "Gördes", "Kırkağaç", "Köprübaşı", "Kula", "Salihli", "Sarıgöl", "Saruhanlı", "Selendi", "Soma", "Şehzadeler", "Turgutlu", "Yunusemre"],
  Kahramanmaraş: ["Afşin", "Andırın", "Çağlayancerit", "Dulkadiroğlu", "Ekinözü", "Elbistan", "Göksun", "Nurhak", "Onikişubat", "Pazarcık", "Türkoğlu"],
  Mardin: ["Artuklu", "Dargeçit", "Derik", "Kızıltepe", "Mazıdağı", "Midyat", "Nusaybin", "Ömerli", "Savur", "Yeşilli"],
  Muğla: ["Bodrum", "Dalaman", "Datça", "Fethiye", "Kavaklıdere", "Köyceğiz", "Marmaris", "Menteşe", "Milas", "Ortaca", "Seydikemer", "Ula", "Yatağan"],
  Muş: ["Bulanık", "Hasköy", "Korkut", "Malazgirt", "Merkez", "Varto"],
  Nevşehir: ["Acıgöl", "Avanos", "Derinkuyu", "Gülşehir", "Hacıbektaş", "Kozaklı", "Merkez", "Ürgüp"],
  Niğde: ["Altunhisar", "Bor", "Çamardı", "Çiftlik", "Merkez", "Ulukışla"],
  Ordu: ["Akkuş", "Altınordu", "Aybastı", "Çamaş", "Çatalpınar", "Çaybaşı", "Fatsa", "Gölköy", "Gülyalı", "Gürgentepe", "İkizce", "Kabadüz", "Kabataş", "Korgan", "Kumru", "Mesudiye", "Perşembe", "Ulubey", "Ünye"],
  Rize: ["Ardeşen", "Çamlıhemşin", "Çayeli", "Derepazarı", "Fındıklı", "Güneysu", "Hemşin", "İkizdere", "İyidere", "Kalkandere", "Merkez", "Pazar"],
  Sakarya: ["Adapazarı", "Akyazı", "Arifiye", "Erenler", "Ferizli", "Geyve", "Hendek", "Karapürçek", "Karasu", "Kaynarca", "Kocaali", "Pamukova", "Sapanca", "Serdivan", "Söğütlü", "Taraklı"],
  Samsun: ["Alaçam", "Asarcık", "Atakum", "Ayvacık", "Bafra", "Canik", "Çarşamba", "Havza", "İlkadım", "Kavak", "Ladik", "Salıpazarı", "Tekkeköy", "Terme", "Vezirköprü", "Yakakent"],
  Siirt: ["Baykan", "Eruh", "Kurtalan", "Merkez", "Pervari", "Şirvan", "Tillo"],
  Sinop: ["Ayancık", "Boyabat", "Dikmen", "Durağan", "Erfelek", "Gerze", "Merkez", "Saraydüzü", "Türkeli"],
  Sivas: ["Akıncılar", "Altınyayla", "Divriği", "Doğanşar", "Gemerek", "Gölova", "Gürün", "Hafik", "İmranlı", "Kangal", "Koyulhisar", "Merkez", "Suşehri", "Şarkışla", "Ulaş", "Yıldızeli", "Zara"],
  Tekirdağ: ["Çerkezköy", "Çorlu", "Ergene", "Hayrabolu", "Kapaklı", "Malkara", "Marmaraereğlisi", "Muratlı", "Saray", "Süleymanpaşa", "Şarköy"],
  Tokat: ["Almus", "Artova", "Başçiftlik", "Erbaa", "Merkez", "Niksar", "Pazar", "Reşadiye", "Sulusaray", "Turhal", "Yeşilyurt", "Zile"],
  Trabzon: ["Akçaabat", "Araklı", "Arsin", "Beşikdüzü", "Çarşıbaşı", "Çaykara", "Dernekpazarı", "Düzköy", "Hayrat", "Köprübaşı", "Maçka", "Of", "Ortahisar", "Sürmene", "Şalpazarı", "Tonya", "Vakfıkebir", "Yomra"],
  Tunceli: ["Çemişgezek", "Hozat", "Mazgirt", "Merkez", "Nazımiye", "Ovacık", "Pertek", "Pülümür"],
  Şanlıurfa: ["Akçakale", "Birecik", "Bozova", "Ceylanpınar", "Eyyübiye", "Halfeti", "Haliliye", "Harran", "Hilvan", "Karaköprü", "Siverek", "Suruç", "Viranşehir"],
  Uşak: ["Banaz", "Eşme", "Karahallı", "Merkez", "Sivaslı", "Ulubey"],
  Van: ["Bahçesaray", "Başkale", "Çaldıran", "Çatak", "Edremit", "Erciş", "Gevaş", "Gürpınar", "İpekyolu", "Muradiye", "Özalp", "Saray", "Tuşba"],
  Yozgat: ["Akdağmadeni", "Aydıncık", "Boğazlıyan", "Çandır", "Çayıralan", "Çekerek", "Kadışehri", "Merkez", "Saraykent", "Sarıkaya", "Sorgun", "Şefaatli", "Yenifakılı", "Yerköy"],
  Zonguldak: ["Alaplı", "Çaycuma", "Devrek", "Ereğli", "Gökçebey", "Kilimli", "Kozlu", "Merkez"],
  Aksaray: ["Ağaçören", "Eskil", "Gülağaç", "Güzelyurt", "Merkez", "Ortaköy", "Sarıyahşi", "Sultanhanı"],
  Bayburt: ["Aydıntepe", "Demirözü", "Merkez"],
  Karaman: ["Ayrancı", "Başyayla", "Ermenek", "Kazımkarabekir", "Merkez", "Sarıveliler"],
  Kırıkkale: ["Bahşili", "Balışeyh", "Çelebi", "Delice", "Karakeçili", "Keskin", "Merkez", "Sulakyurt", "Yahşihan"],
  Batman: ["Beşiri", "Gercüş", "Hasankeyf", "Kozluk", "Merkez", "Sason"],
  Şırnak: ["Beytüşşebap", "Cizre", "Güçlükonak", "İdil", "Merkez", "Silopi", "Uludere"],
  Bartın: ["Amasra", "Kurucaşile", "Merkez", "Ulus"],
  Ardahan: ["Çıldır", "Damal", "Göle", "Hanak", "Merkez", "Posof"],
  Iğdır: ["Aralık", "Karakoyunlu", "Merkez", "Tuzluca"],
  Yalova: ["Altınova", "Armutlu", "Çınarcık", "Çiftlikköy", "Merkez", "Termal"],
  Karabük: ["Eflani", "Eskipazar", "Merkez", "Ovacık", "Safranbolu", "Yenice"],
  Kilis: ["Elbeyli", "Merkez", "Musabeyli", "Polateli"],
  Osmaniye: ["Bahçe", "Düziçi", "Hasanbeyli", "Kadirli", "Merkez", "Sumbas", "Toprakkale"],
  Düzce: ["Akçakoca", "Cumayeri", "Çilimli", "Gölyaka", "Gümüşova", "Kaynaşlı", "Merkez", "Yığılca"],
};

/** Popular neighborhoods for major districts */
const neighborhoods = {
  "İstanbul|Kadıköy": ["Caferağa", "Moda", "Osmanağa", "Rasimpaşa", "Kozyatağı", "Bostancı", "Fenerbahçe", "Göztepe", "Erenköy", "Suadiye", "Caddebostan", "Acıbadem", "Hasanpaşa", "Merdivenköy", "19 Mayıs"],
  "İstanbul|Üsküdar": ["Altunizade", "Acıbadem", "Bulgurlu", "Çengelköy", "Kuzguncuk", "Beylerbeyi", "Salacak", "Selami Ali", "İcadiye", "Valide-i Atik", "Burhaniye", "Küçük Çamlıca"],
  "İstanbul|Beşiktaş": ["Levent", "Etiler", "Bebek", "Ortaköy", "Arnavutköy", "Nişantaşı", "Gayrettepe", "Dikilitaş", "Sinanpaşa", "Türkali", "Abbasağa", "Yıldız"],
  "İstanbul|Şişli": ["Nişantaşı", "Teşvikiye", "Osmanbey", "Mecidiyeköy", "Fulya", "Bomonti", "Halaskargazi", "Cumhuriyet", "Esentepe", "Feriköy", "Kurtuluş"],
  "İstanbul|Fatih": ["Sultanahmet", "Aksaray", "Laleli", "Fındıkzade", "Kocamustafapaşa", "Samatya", "Balat", "Fener", "Karagümrük", "Topkapı", "Eminönü", "Beyazıt"],
  "İstanbul|Bakırköy": ["Ataköy", "Yeşilköy", "Florya", "Kartaltepe", "Osmaniye", "Zuhuratbaba", "Cevizlik", "Yeşilyurt", "Şenlikköy"],
  "İstanbul|Başakşehir": ["Bahçeşehir", "Kayaşehir", "İkitelli", "Altınşehir", "Başak", "Güvercintepe", "Şahintepe"],
  "İstanbul|Ataşehir": ["Atatürk", "Barbaros", "Ferhatpaşa", "İçerenköy", "Kayışdağı", "Küçükbakkalköy", "Mustafa Kemal", "Örnek", "Yeni Sahra"],
  "İstanbul|Maltepe": ["Başıbüyük", "Cevizli", "Feyzullah", "Gülsuyu", "İdealtepe", "Küçükyalı", "Bağlarbaşı", "Altayçeşme", "Zümrütevler"],
  "İstanbul|Pendik": ["Kurtköy", "Yenişehir", "Güzelyalı", "Esenyalı", "Çamçeşme", "Kaynarca", "Sapanbağları", "Bahçelievler"],
  "İstanbul|Sarıyer": ["Maslak", "Tarabya", "Yeniköy", "İstinye", "Emirgan", "Rumeli Hisarı", "Büyükdere", "Bahçeköy", "Zekeriyaköy"],
  "İstanbul|Beylikdüzü": ["Adnan Kahveci", "Barış", "Büyükşehir", "Cumhuriyet", "Dereağzı", "Gürpınar", "Kavaklı", "Marmara", "Sahil", "Yakuplu"],
  "İstanbul|Esenyurt": ["Ardıçlı", "Bağlarçeşme", "Cumhuriyet", "Fatih", "Güzelyurt", "İncirtepe", "Mevlana", "Örnek", "Pınar", "Saadetdere", "Yenikent"],
  "İstanbul|Kartal": ["Atalar", "Cevizli", "Esentepe", "Gümüşpınar", "Hürriyet", "Karlıktepe", "Kordonboyu", "Orhantepe", "Petrol İş", "Soğanlık", "Yakacık"],
  "İstanbul|Ümraniye": ["Atakent", "Atatürk", "Çakmak", "Dudullu", "Esenşehir", "İnkılap", "Namık Kemal", "Tantavi", "Yamanevler"],
  "Ankara|Çankaya": ["Kızılay", "Bahçelievler", "Çukurambar", "Balgat", "Ayrancı", "Çayyolu", "Ümitköy", "Oran", "Birlik", "Yıldızevler", "Gaziosmanpaşa", "Kavaklıdere", "Dikmen", "Öveçler"],
  "Ankara|Keçiören": ["Aktepe", "Ayvalı", "Bağlarbaşı", "Esertepe", "Etlik", "Kalaba", "Kuşcağız", "Osmangazi", "Sanatoryum", "Şehit Kubilay", "Ufuktepe", "Yayla"],
  "Ankara|Yenimahalle": ["Batıkent", "Demetevler", "İvedik", "Karşıyaka", "Ostim", "Susuz", "Yeni Batı", "Ergazi", "Macun"],
  "Ankara|Etimesgut": ["Eryaman", "Elvan", "Alsancak", "Ayyıldız", "Bağlıca", "Elvankent", "Göksu", "Piyade", "Şehit Osman Avcı", "Turkuaz"],
  "Ankara|Mamak": ["Abidinpaşa", "Akdere", "Boğaziçi", "Derbent", "Hürel", "Kutludüğün", "Mutlu", "Şafaktepe", "Türközü"],
  "Ankara|Altındağ": ["Aydınlıkevler", "Hasköy", "İskitler", "Önder", "Ulubey", "Doğanbey", "Gülveren"],
  "Ankara|Sincan": ["Andiçen", "Fatih", "Gazi", "Osmaniye", "Plevne", "Törekent", "Yenikent", "29 Ekim"],
  "İzmir|Konak": ["Alsancak", "Göztepe", "Güzelyalı", "Karataş", "Kahramanlar", "Pasaport", "Eşrefpaşa", "Güneşli", "Mithatpaşa", "Yenişehir"],
  "İzmir|Karşıyaka": ["Bostanlı", "Mavişehir", "Alaybey", "Donanmacı", "Nergiz", "Tuna", "Yamanlar", "Cumhuriyet", "Örnekköy"],
  "İzmir|Bornova": ["Erzene", "Evka", "Kazımdirik", "Mevlana", "Naldöken", "Üniversite", "Çiçekli", "Altındağ", "Doğanlar"],
  "İzmir|Buca": ["Adatepe", "Cumhuriyet", "İnkılap", "Kuruçeşme", "Şirinyer", "Yıldız", "Kozağaç", "Yiğitler"],
  "İzmir|Bayraklı": ["Mansuroğlu", "Osmangazi", "Soğukkuyu", "Turan", "Adalet", "Çiçek", "Postacılar"],
  "İzmir|Çiğli": ["Ataşehir", "Balatçık", "Harmandalı", "Küçük Çiğli", "Sasalı", "Şirintepe", "Yeni Mahalle"],
  "İzmir|Gaziemir": ["Aktepe", "Atıfbey", "Beyazevler", "Emrez", "Fatih", "Irmak", "Menderes", "Yeşil"],
  "Antalya|Muratpaşa": ["Bahçelievler", "Fener", "Güzeloba", "Kızıltoprak", "Lara", "Meltem", "Şirinyalı", "Yenigöl", "Zerdalilik", "Çağlayan"],
  "Antalya|Kepez": ["Ahatlı", "Altınova", "Varsak", "Güneş", "Erenköy", "Duacı", "Odabaşı", "Şafak"],
  "Antalya|Konyaaltı": ["Hurma", "Liman", "Arapsuyu", "Altınkum", "Uncalı", "Siteler", "Gürsu", "Çakırlar"],
  "Antalya|Alanya": ["Mahmutlar", "Oba", "Cikcilli", "Tosmur", "Kestel", "Payallar", "Konaklı", "Türkler", "Avsallar"],
  "Antalya|Manavgat": ["Side", "Çolaklı", "Evrenseki", "Ilıca", "Sorgun", "Taşağıl", "Tilkiler"],
  "Bursa|Nilüfer": ["Özlüce", "Beşevler", "Görükle", "İhsaniye", "Konak", "Üçevler", "Fethiye", "Odunluk", "Ataevler"],
  "Bursa|Osmangazi": ["Altıparmak", "Çekirge", "Hamitler", "Hüdavendigar", "Soğanlı", "Panayır", "Demirtaş", "Emek"],
  "Bursa|Yıldırım": ["Arabayatağı", "Davutkadı", "Emirsultan", "Esenevler", "Mimarsinan", "Yavuzselim", "Yiğitler"],
  "Bursa|Mudanya": ["Güzelyalı", "Halitpaşa", "Ömerbey", "Tirilye", "Kumyaka"],
  "Muğla|Bodrum": ["Bitez", "Gümbet", "Yalıkavak", "Türkbükü", "Turgutreis", "Gündoğan", "Ortaca", "Konacık", "Mumcular"],
  "Muğla|Fethiye": ["Çalış", "Ölüdeniz", "Hisarönü", "Ovacık", "Kayaköy", "Karaçulha", "Taşyaka"],
  "Muğla|Marmaris": ["Armutalan", "İçmeler", "Siteler", "Beldibi", "Turunç", "Çamlı"],
  "Kocaeli|İzmit": ["Yenişehir", "Kuruçeşme", "Kozluk", "Tavşancıl", "28 Haziran", "Gündoğdu", "Karabaş"],
  "Kocaeli|Gebze": ["Beylikbağı", "Güzeller", "Hacıhalil", "Mevlana", "Osman Yılmaz", "Tatlıkuyu", "Yavuz Selim"],
  "Sakarya|Adapazarı": ["Semerciler", "Papuççular", "Tığcılar", "Yenidoğan", "Camili", "Karaosman"],
  "Eskişehir|Odunpazarı": ["Büyükdere", "Cengiz Topel", "Göztepe", "Ihlamurkent", "Kurtuluş", "Vişnelik", "Yenikent"],
  "Eskişehir|Tepebaşı": ["Batıkent", "Çamlıca", "Ertuğrulgazi", "Şirintepe", "Tunalı", "Yenibağlar"],
  "Gaziantep|Şahinbey": ["Güneş", "İbrahimli", "Karataş", "Perilikaya", "Ünaldı", "75. Yıl", "Akkent"],
  "Gaziantep|Şehitkamil": ["Beylerbeyi", "Çıksorut", "Güneş", "Onur", "Sarıgüllük", "Yeditepe"],
};

const DEFAULT_NEIGHBORHOODS = ["Merkez", "Cumhuriyet", "Atatürk", "Yeni Mahalle", "Fatih", "Yavuz Selim", "İstiklal", "Bahçelievler", "Gazi", "Hürriyet"];

const cities = Object.keys(districtsByCity)
  .sort((a, b) => a.localeCompare(b, "tr"))
  .map((city) => ({
    name: city,
    districts: districtsByCity[city].map((district) => {
      const key = `${city}|${district}`;
      const list = neighborhoods[key] || DEFAULT_NEIGHBORHOODS;
      return { name: district, neighborhoods: list };
    }),
  }));

const outDir = path.join(__dirname, "..", "src", "data");
fs.mkdirSync(outDir, { recursive: true });
const jsonPath = path.join(outDir, "turkey-locations.json");
fs.writeFileSync(jsonPath, JSON.stringify({ cities }, null, 0), "utf8");

const tsPath = path.join(outDir, "turkey-locations.ts");
fs.writeWrite = undefined;
fs.writeFileSync(
  tsPath,
  `import data from "./turkey-locations.json";

export type TurkeyDistrict = {
  name: string;
  neighborhoods: string[];
};

export type TurkeyCity = {
  name: string;
  districts: TurkeyDistrict[];
};

export const TURKEY_CITIES = data.cities as TurkeyCity[];

export const CITY_NAMES = TURKEY_CITIES.map((c) => c.name);

export function getCity(name: string) {
  return TURKEY_CITIES.find((c) => c.name === name) || null;
}

export function getDistricts(city: string) {
  return getCity(city)?.districts.map((d) => d.name) || [];
}

export function getNeighborhoods(city: string, district: string) {
  const d = getCity(city)?.districts.find((x) => x.name === district);
  return d?.neighborhoods || [];
}

export const SALE_PRICE_OPTIONS = [
  250_000, 500_000, 750_000, 1_000_000, 1_500_000, 2_000_000, 3_000_000, 5_000_000, 7_500_000, 10_000_000, 15_000_000, 20_000_000, 30_000_000, 50_000_000,
] as const;

export const RENT_PRICE_OPTIONS = [
  5_000, 7_500, 10_000, 12_500, 15_000, 20_000, 25_000, 30_000, 40_000, 50_000, 75_000, 100_000, 150_000, 200_000,
] as const;
`,
  "utf8"
);

console.log(`Cities: ${cities.length}`);
console.log(`Wrote ${jsonPath}`);
console.log(`Wrote ${tsPath}`);
