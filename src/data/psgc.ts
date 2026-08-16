/**
 * Philippine Standard Geographic Code (PSGC) Reference Dataset
 * Ordered in standard Philippine administrative sequence:
 * 1. NCR, 2. CAR, 3. Region I to XIII, 4. BARMM
 * All provinces, cities, and barangays are sorted alphabetically.
 */

export interface PsgcCity {
  readonly code: string;
  readonly name: string;
  readonly zipCode?: string;
  readonly barangays: readonly string[];
}

export interface PsgcProvince {
  readonly code: string;
  readonly name: string;
  readonly cities: readonly PsgcCity[];
}

export interface PsgcRegion {
  readonly code: string;
  readonly name: string;
  readonly shortName: string;
  readonly provinces: readonly PsgcProvince[];
}

export const PSGC_REGIONS: readonly PsgcRegion[] = [
  // 1. NCR
  {
    code: '130000000',
    name: 'National Capital Region (NCR)',
    shortName: 'NCR',
    provinces: [
      {
        code: '133900000',
        name: 'Metro Manila - 1st District (City of Manila)',
        cities: [
          {
            code: '133901000',
            name: 'City of Manila',
            zipCode: '1000',
            barangays: ['Binondo', 'Ermita', 'Intramuros', 'Malate', 'Paco', 'Pandacan', 'Port Area', 'Quiapo', 'Sampaloc', 'San Andres', 'San Miguel', 'San Nicolas', 'Santa Ana', 'Santa Cruz', 'Santa Mesa', 'Tondo'],
          },
        ],
      },
      {
        code: '137400000',
        name: 'Metro Manila - 2nd District',
        cities: [
          {
            code: '137402000',
            name: 'Mandaluyong City',
            zipCode: '1550',
            barangays: ['Addition Hills', 'Barangka Drive', 'Barangka Ilaya', 'Highway Hills', 'Hulo', 'Malamig', 'Plainview', 'Pleasant Hills', 'Wack-Wack Greenhills'],
          },
          {
            code: '137403000',
            name: 'Marikina City',
            zipCode: '1800',
            barangays: ['Barangka', 'Concepcion Uno', 'Concepcion Dos', 'Fortune', 'Industrial Valley', 'Marikina Heights', 'Nangka', 'Parang', 'San Roque', 'Santa Elena', 'Santo Niño', 'Tumana'],
          },
          {
            code: '137404000',
            name: 'Pasig City',
            zipCode: '1600',
            barangays: ['Bagong Ilog', 'Caniogan', 'Kapitolyo', 'Manggahan', 'Maybunga', 'Oranbo', 'Pinagbuhatan', 'Rosario', 'San Antonio', 'San Joaquin', 'San Nicolas', 'Santa Lucia', 'Ugong'],
          },
          {
            code: '137401000',
            name: 'Quezon City',
            zipCode: '1100',
            barangays: ['Bagong Silangan', 'Batasan Hills', 'Central', 'Commonwealth', 'Culiat', 'Damayan', 'Fairview', 'Greater Lagro', 'Holy Spirit', 'Kamuning', 'Loyola Heights', 'Matandang Balara', 'Novaliches Proper', 'Pansol', 'Payatas', 'Pinagkaisahan', 'Tatalon'],
          },
          {
            code: '137405000',
            name: 'San Juan City',
            zipCode: '1500',
            barangays: ['Addition Hills', 'Batis', 'Greenhills', 'Little Baguio', 'Maytunas', 'Onse', 'Pasadeña', 'Progreso', 'Santa Lucia', 'West Crame'],
          },
        ],
      },
      {
        code: '137500000',
        name: 'Metro Manila - 3rd District (CAMANAVA)',
        cities: [
          {
            code: '137501000',
            name: 'Caloocan City',
            zipCode: '1400',
            barangays: ['Bagumbong', 'Bagong Silang (Brgy 176)', 'Barangay 1', 'Barangay 12', 'Barangay 80', 'Camarin (Brgy 178)', 'Grace Park', 'Maypajo', 'Morning Breeze', 'Tala (Brgy 180)'],
          },
          {
            code: '137502000',
            name: 'Malabon City',
            zipCode: '1470',
            barangays: ['Acacia', 'Baritan', 'Catmon', 'Concepcion', 'Flores', 'Hulong Duhat', 'Ibaba', 'Longos', 'Niugan', 'Potrero', 'San Agustin', 'Tañong', 'Tonsuya', 'Tugatog'],
          },
          {
            code: '137503000',
            name: 'Navotas City',
            zipCode: '1485',
            barangays: ['Bagumbayan North', 'Bagumbayan South', 'Daanghari', 'Navotas East', 'Navotas West', 'North Bay Boulevard North', 'North Bay Boulevard South', 'San Jose', 'San Rafael Village', 'San Roque', 'Tangos North', 'Tangos South', 'Tanza'],
          },
          {
            code: '137504000',
            name: 'Valenzuela City',
            zipCode: '1440',
            barangays: ['Arkong Bato', 'Bignay', 'Canumay East', 'Canumay West', 'Gen. T. de Leon', 'Karuhatan', 'Lawang Bato', 'Malanday', 'Malinta', 'Mapulang Lupa', 'Paso de Blas', 'Poblacion', 'Punturin', 'Ugong'],
          },
        ],
      },
      {
        code: '137600000',
        name: 'Metro Manila - 4th District',
        cities: [
          {
            code: '137605000',
            name: 'Las Piñas City',
            zipCode: '1740',
            barangays: ['Almanza Uno', 'Almanza Dos', 'BF International Village', 'Daniel Fajardo', 'Elias Aldana', 'Ilaya', 'Manuyo Uno', 'Manuyo Dos', 'Pamplona Uno', 'Pamplona Dos', 'Pamplona Tres', 'Pilar', 'Pulang Lupa Uno', 'Pulang Lupa Dos', 'Talon Uno', 'Talon Dos', 'Zapote'],
          },
          {
            code: '137601000',
            name: 'Makati City',
            zipCode: '1200',
            barangays: ['Bel-Air', 'Carmona', 'Dasmariñas', 'Forbes Park', 'Guadalupe Nuevo', 'Guadalupe Viejo', 'Kasilawan', 'Magallanes', 'Olympia', 'Palanan', 'Pio del Pilar', 'Poblacion', 'San Antonio', 'San Lorenzo', 'Singkamas', 'Tejeros', 'Urdaneta', 'Valenzuela'],
          },
          {
            code: '137606000',
            name: 'Muntinlupa City',
            zipCode: '1770',
            barangays: ['Alabang', 'Ayala Alabang', 'Bayanan', 'Buli', 'Cupang', 'Poblacion', 'Putatan', 'Sucat', 'Tunasan'],
          },
          {
            code: '137604000',
            name: 'Parañaque City',
            zipCode: '1700',
            barangays: ['Baclaran', 'BF Homes', 'Don Bosco', 'Don Galo', 'La Huerta', 'Marcelo Green', 'Merville', 'Moonwalk', 'San Antonio', 'San Dionisio', 'San Isidro', 'San Martin de Porres', 'Santo Niño', 'Sun Valley', 'Tambo', 'Vitalez'],
          },
          {
            code: '137603000',
            name: 'Pasay City',
            zipCode: '1300',
            barangays: ['Barangay 1', 'Barangay 10', 'Barangay 76 (MOA)', 'Barangay 183 (Villamor)', 'Malibay', 'Maricaban', 'San Isidro', 'San Jose', 'San Rafael', 'Santa Clara'],
          },
          {
            code: '137607000',
            name: 'Pateros (Municipality)',
            zipCode: '1620',
            barangays: ['Aguho', 'Magtanggol', 'Martires del 96', 'Poblacion', 'San Pedro', 'San Roque', 'Santa Ana', 'Santo Rosario-Kanluran', 'Santo Rosario-Silangan', 'Tabacalera'],
          },
          {
            code: '137602000',
            name: 'Taguig City',
            zipCode: '1630',
            barangays: ['Bagumbayan', 'Bambang', 'Calzada', 'Central Bicutan', 'Fort Bonifacio (BGC)', 'Hagonoy', 'Ibayo-Tipas', 'Ligid-Tipas', 'Lower Bicutan', 'Maharlika Village', 'Napindan', 'Palingon', 'Pinagsama', 'San Miguel', 'Santa Ana', 'Signal Village', 'Tuktukan', 'Upper Bicutan', 'Ususan', 'Western Bicutan'],
          },
        ],
      },
    ],
  },

  // 2. CAR
  {
    code: '140000000',
    name: 'Cordillera Administrative Region (CAR)',
    shortName: 'CAR',
    provinces: [
      {
        code: '140100000',
        name: 'Abra',
        cities: [
          { code: '140101000', name: 'Bangued', zipCode: '2800', barangays: ['Agsubay', 'Angad', 'Bañacao', 'Bangbangar', 'Cabuloan', 'Calaba', 'Cosili West', 'Dangdangla', 'Lingtan', 'Lipcan', 'Malita', 'Poblacion', 'Zone 1', 'Zone 2', 'Zone 5'] },
        ],
      },
      {
        code: '141100000',
        name: 'Benguet',
        cities: [
          { code: '141102000', name: 'Baguio City', zipCode: '2600', barangays: ['Asin Road', 'Bakakeng Central', 'Camp 7', 'Country Club Village', 'Engineers\' Hill', 'Gibraltar', 'Irisan', 'Loakan Proper', 'Mines View Park', 'Pacasdal', 'Poblacion', 'San Vicente', 'Session Road (Poblacion)', 'Trancoville'] },
          { code: '141101000', name: 'La Trinidad', zipCode: '2601', barangays: ['Alapang', 'Alno', 'Ambiong', 'Bahong', 'Balili', 'Beckel', 'Betag', 'Cruz', 'Poblacion', 'Puguis', 'Shilan', 'Tawang', 'Wangal'] },
        ],
      },
      {
        code: '142700000',
        name: 'Ifugao',
        cities: [
          { code: '142701000', name: 'Lagawe', zipCode: '3600', barangays: ['Abinuan', 'Banga', 'Boliwong', 'Burnay', 'Caba', 'Montabiong', 'Poblacion East', 'Poblacion West', 'Ponghal', 'San Fernando', 'Tungngod'] },
        ],
      },
      {
        code: '143200000',
        name: 'Kalinga',
        cities: [
          { code: '143201000', name: 'Tabuk City', zipCode: '3800', barangays: ['Agbannawag', 'Appas', 'Bulanao', 'Bulanao Centro', 'Cabaruan', 'Dagupan Centro', 'Laya East', 'Laya West', 'Nambaran', 'San Juan'] },
        ],
      },
      {
        code: '144400000',
        name: 'Mountain Province',
        cities: [
          { code: '144401000', name: 'Bontoc', zipCode: '2616', barangays: ['Alab Proper', 'Balili', 'Bontoc Ili', 'Caluttit', 'Guina-ang', 'Mainit', 'Maligcong', 'Poblacion', 'Samoki', 'Talubin', 'Tocucan'] },
          { code: '144402000', name: 'Sagada', zipCode: '2615', barangays: ['Aguid', 'Ambasing', 'Angkeling', 'Antadao', 'Balugan', 'Bangaan', 'Dagdag', 'Demang', 'Fidelisan', 'Kiltepan', 'Madongo', 'Poblacion', 'Tanulong'] },
        ],
      },
    ],
  },

  // 3. Region I
  {
    code: '010000000',
    name: 'Region I (Ilocos Region)',
    shortName: 'Region I',
    provinces: [
      {
        code: '012800000',
        name: 'Ilocos Norte',
        cities: [
          { code: '012801000', name: 'Laoag City', zipCode: '2900', barangays: ['Barit', 'Buttong', 'Caaoacan', 'Cavit', 'Giron', 'Nangalisan', 'Nalbo', 'Pila', 'San Mateo', 'Santa Maria', 'Zamboanga'] },
          { code: '012802000', name: 'Batac City', zipCode: '2906', barangays: ['Aglipay', 'Baay', 'Baligat', 'Bungon', 'Callaguip', 'Lacub', 'Palpalicong', 'Poblacion', 'Quiling Sur', 'Rayuray'] },
        ],
      },
      {
        code: '012900000',
        name: 'Ilocos Sur',
        cities: [
          { code: '012901000', name: 'Vigan City', zipCode: '2700', barangays: ['Ayusan Norte', 'Ayusan Sur', 'Beddeng Laud', 'Bongtolan', 'Bulala', 'Capangpangan', 'Mindoro', 'Paoa', 'Poblacion', 'Pantay Daya', 'Salcedo', 'Tamag'] },
          { code: '012902000', name: 'Candon City', zipCode: '2710', barangays: ['Bagani Campo', 'Calaoa-an', 'Darapidap', 'Oaig Daya', 'Palacapac', 'Parioc Primero', 'Poblacion', 'San Isidro', 'Talogtog'] },
        ],
      },
      {
        code: '013300000',
        name: 'La Union',
        cities: [
          { code: '013301000', name: 'San Fernando City', zipCode: '2500', barangays: ['Biday', 'Carlatan', 'Catbangen', 'Dalumpinas Oeste', 'Lingsat', 'Madayegdeg', 'Pagudpud', 'Poro', 'San Agustin', 'Sevilla', 'Tanqui'] },
        ],
      },
      {
        code: '015500000',
        name: 'Pangasinan',
        cities: [
          { code: '015501000', name: 'Dagupan City', zipCode: '2400', barangays: ['Bacayao Norte', 'Bonuan Binloc', 'Bonuan Boquig', 'Bonuan Gueset', 'Calmay', 'Carael', 'Herrero', 'Lucao', 'Malued', 'Mayombo', 'Pantal', 'Poblacion Oeste', 'Tapuac'] },
          { code: '015502000', name: 'San Carlos City', zipCode: '2420', barangays: ['Abanon', 'Agdao', 'Balaya', 'Bocboc', 'Caoayan Kiling', 'Coliling', 'Mabalbalino', 'Palaris', 'Poblacion', 'Rizal', 'Tarece', 'Turac'] },
          { code: '015503000', name: 'Urdaneta City', zipCode: '2428', barangays: ['Anonas', 'Bactad East', 'Camantiles', 'Catablan', 'Dr. Pedro T. Orata', 'Nancayasan', 'Pinmaludpod', 'Poblacion', 'San Jose', 'San Vicente'] },
        ],
      },
    ],
  },

  // 4. Region II
  {
    code: '020000000',
    name: 'Region II (Cagayan Valley)',
    shortName: 'Region II',
    provinces: [
      {
        code: '021500000',
        name: 'Cagayan',
        cities: [
          { code: '021501000', name: 'Tuguegarao City', zipCode: '3500', barangays: ['Annafunan East', 'Atulayan Norte', 'Bagay', 'Buntun', 'Capatan', 'Carig Norte', 'Carig Sur', 'Cataggaman Nuevo', 'Centro 1 (Poblacion)', 'Linao East', 'Pengue-Ruyu', 'San Gabriel', 'Tanza'] },
        ],
      },
      {
        code: '023100000',
        name: 'Isabela',
        cities: [
          { code: '023101000', name: 'Cauayan City', zipCode: '3305', barangays: ['Alicaocao', 'Cabuan', 'District 1 (Poblacion)', 'District 2', 'Labinab', 'Minante 1', 'Nungnungan 1', 'San Fermin', 'Tagaran', 'Turayong'] },
          { code: '023102000', name: 'Ilagan City', zipCode: '3300', barangays: ['Alibagu', 'Baluco', 'Calamagui 1st', 'Centro Poblacion', 'Guinatan', 'Marana 1st', 'Osmeña', 'San Vicente', 'Santa Barbara'] },
          { code: '023103000', name: 'Santiago City', zipCode: '3311', barangays: ['Batal', 'Calao East', 'Calao West', 'Centro East', 'Centro West', 'Dubinan East', 'Dubinan West', 'Mabini', 'Plaridel', 'Rizal', 'Rosario', 'San Andres', 'Victory Norte'] },
        ],
      },
      {
        code: '025000000',
        name: 'Nueva Vizcaya',
        cities: [
          { code: '025001000', name: 'Bayombong', zipCode: '3700', barangays: ['Bonfal East', 'Bonfal Proper', 'Bonfal West', 'Busilac', 'Casat', 'Don Mariano Marcos', 'Magat', 'Poblacion', 'Salvacion', 'Santa Rosa', 'Vista Alegre'] },
          { code: '025002000', name: 'Solano', zipCode: '3709', barangays: ['Aggub', 'Bangaan', 'Curifang', 'Dadap', 'Gaddani', 'General Luna', 'Osmeña', 'Poblacion North', 'Poblacion South', 'Quezon', 'Roxas', 'San Luis', 'Tucal'] },
        ],
      },
      {
        code: '025700000',
        name: 'Quirino',
        cities: [
          { code: '025701000', name: 'Cabarroguis', zipCode: '3400', barangays: ['Banuar', 'Burgos', 'Calaocan', 'Del Pilar', 'Dibul', 'Eden', 'Gundaway', 'Mangandingay', 'San Marcos', 'Villamor', 'Zamora'] },
        ],
      },
    ],
  },

  // 5. Region III
  {
    code: '030000000',
    name: 'Region III (Central Luzon)',
    shortName: 'Region III',
    provinces: [
      {
        code: '030800000',
        name: 'Bataan',
        cities: [
          { code: '030801000', name: 'Balanga City', zipCode: '2100', barangays: ['Bagong Silang', 'Bagumbayan', 'Cabog-Cabog', 'Camacho', 'Cataning', 'Cupang North', 'Doña Francisca', 'Ibayo', 'Poblacion', 'Puerto Rivas Ibaba', 'San Jose', 'Tenejero', 'Tortugas', 'Tuyo'] },
        ],
      },
      {
        code: '031400000',
        name: 'Bulacan',
        cities: [
          { code: '031401000', name: 'City of San Jose del Monte', zipCode: '3023', barangays: ['Ciudad Real', 'Feliciano', 'Francisco Homes-Guijo', 'Graceville', 'Kaybanban', 'Muzon East', 'Muzon Proper', 'Paradise 3', 'Poblacion', 'Santo Cristo', 'Sapang Palay', 'Tungkong Mangga'] },
          { code: '031402000', name: 'Malolos City', zipCode: '3000', barangays: ['Atlagon', 'Bagna', 'Balayong', 'Bulihan', 'Caingin', 'Canalate', 'Catmon', 'Cofradia', 'Dakila', 'Guinhawa', 'Liang', 'Longos', 'Lugam', 'Mojon', 'Panasahan', 'Pinagbakahan', 'San Agustin', 'San Gabriel', 'San Vicente', 'Santol', 'Santo Cristo', 'Santo Rosario', 'Sumapang Matanda'] },
          { code: '031403000', name: 'Meycauayan City', zipCode: '3020', barangays: ['Bancal', 'Bangkal', 'Calvario', 'Camalig', 'Hulo', 'Iba', 'Langka', 'Malhacan', 'Pajo', 'Pandayan', 'Perez', 'Poblacion', 'Saluysoy', 'Tugatog', 'Ubihan', 'Zamora'] },
        ],
      },
      {
        code: '034900000',
        name: 'Nueva Ecija',
        cities: [
          { code: '034901000', name: 'Cabanatuan City', zipCode: '3100', barangays: ['Aduas Centro', 'Bantug Bulalo', 'Barrera District', 'Bitas', 'Camp Tinio', 'Kapitan Pepe', 'Mabini Extension', 'Magsaysay Norte', 'Mayapyap Sur', 'Poblacion', 'San Josef Sur', 'San Roque Norte', 'Sangitan East', 'Valdefuente', 'Zulueta'] },
        ],
      },
      {
        code: '035400000',
        name: 'Pampanga',
        cities: [
          { code: '035401000', name: 'Angeles City', zipCode: '2009', barangays: ['Anunas', 'Balibago', 'Capaya', 'Cutcut', 'Lourdes North West', 'Malabanias', 'Mining', 'Pampang', 'Pandang', 'Pulung Cacutud', 'Pulung Maragul', 'Salapungan', 'Santo Cristo', 'Santo Domingo', 'Santo Rosario (Poblacion)', 'Tabun'] },
          { code: '035402000', name: 'City of San Fernando', zipCode: '2000', barangays: ['Baluarte', 'Calulut', 'Del Carmen', 'Del Pilar', 'Dolores', 'Juliana', 'Lara', 'Magliman', 'Maimpis', 'Malpitic', 'Panipuan', 'Quebiawan', 'Saguin', 'San Agustin', 'San Isidro', 'San Jose', 'San Nicolas', 'San Pedro', 'Santa Lucia', 'Santo Niño', 'Sindalan', 'Telabastagan'] },
          { code: '035403000', name: 'Mabalacat City', zipCode: '2010', barangays: ['Atlu-Bola', 'Bical', 'Bundagul', 'Cacutud', 'Calumpang', 'Camachiles', 'Dau', 'Dolores', 'Dapdap', 'Mabiga', 'Poblacion', 'San Francisco', 'Santa Ines', 'Santa Maria', 'Tabun'] },
        ],
      },
      {
        code: '036900000',
        name: 'Tarlac',
        cities: [
          { code: '036901000', name: 'Tarlac City', zipCode: '2300', barangays: ['Aguso', 'Amucao', 'Balanti', 'Baras-Baras', 'Binauganan', 'Burot', 'Carangian', 'Cut-cut 1st', 'Dolores', 'Ligtasan', 'Mabini', 'Matatalaib', 'Poblacion', 'Salapungan', 'San Isidro', 'San Nicolas', 'San Rafael', 'San Roque', 'San Sebastian', 'San Vicente', 'Santa Cruz', 'Santo Cristo', 'Sepung Calzada', 'Suizo', 'Tibag'] },
        ],
      },
      {
        code: '037100000',
        name: 'Zambales',
        cities: [
          { code: '037101000', name: 'Olongapo City', zipCode: '2200', barangays: ['Asinan', 'Banicain', 'Barretto', 'Calapacuan', 'East Bajac-Bajac', 'East Tapinac', 'Gordon Heights', 'Kalaklan', 'Mabayuan', 'New Cabalan', 'New Ilalim', 'New Kababae', 'New Kalalake', 'Old Cabalan', 'Pag-asa', 'Santa Rita', 'West Bajac-Bajac', 'West Tapinac'] },
        ],
      },
    ],
  },

  // 6. Region IV-A
  {
    code: '040000000',
    name: 'Region IV-A (CALABARZON)',
    shortName: 'CALABARZON',
    provinces: [
      {
        code: '041000000',
        name: 'Batangas',
        cities: [
          { code: '041001000', name: 'Batangas City', zipCode: '4200', barangays: ['Alangilan', 'Balagtas', 'Bolbok', 'Calicanto', 'Cuta', 'Kumintang Ibaba', 'Kumintang Ilaya', 'Libjo', 'Pallocan West', 'Poblacion', 'San Isidro', 'Santa Rita Aplaya', 'Tabangao Ambulong'] },
          { code: '041002000', name: 'Lipa City', zipCode: '4217', barangays: ['Balintawak', 'Banaybanay', 'Bugtong na Pulo', 'Bulacnin', 'Dagatan', 'Halang', 'Inosloban', 'Lodlod', 'Marawoy', 'Mataas na Lupa', 'Pangao', 'Pinagtongulan', 'Plaridel', 'Poblacion', 'Sabang', 'Sampaguita', 'San Carlos', 'San Celestino', 'San Lucas', 'San Salvador', 'Santo Niño', 'Santo Toribio', 'Tambo', 'Tangway', 'Tibig'] },
        ],
      },
      {
        code: '042100000',
        name: 'Cavite',
        cities: [
          { code: '042101000', name: 'Bacoor City', zipCode: '4102', barangays: ['Habay I', 'Habay II', 'Molino I', 'Molino II', 'Molino III', 'Molino IV', 'Panapaan I', 'Queens Row Central', 'Queens Row East', 'Queens Row West', 'San Nicolas I', 'San Nicolas II', 'Talaba I', 'Talaba VII', 'Zapote I', 'Zapote V'] },
          { code: '042103000', name: 'Dasmariñas City', zipCode: '4114', barangays: ['Burol', 'Fatima I', 'Langkaan I', 'Paliparan I', 'Paliparan II', 'Paliparan III', 'Salawag', 'Salitran I', 'Sampaloc I', 'San Agustin I', 'Victoria Reyes'] },
          { code: '042105000', name: 'General Trias City', zipCode: '4107', barangays: ['Arnaldo', 'Bacao I', 'Gov. Ferrer Poblacion', 'Manggahan', 'Navarro', 'Pasong Camachile I', 'Pasong Kawayan I', 'San Francisco', 'Santiago', 'Tejero'] },
          { code: '042102000', name: 'Imus City', zipCode: '4103', barangays: ['Alapan I-A', 'Anabu I-A', 'Bucandala I', 'Carsadang Bago I', 'Malagasang I-A', 'Medicion I-A', 'Poblacion I-A', 'Tanzang Luma I', 'Toclong I-A'] },
          { code: '042104000', name: 'Tagaytay City', zipCode: '4120', barangays: ['Asisan', 'Bagong Tubig', 'Calabuso', 'Kaybagal Central', 'Maharlika East', 'Mendez Crossing East', 'San Jose', 'Silang Junction North', 'Sungay North', 'Tolentino East'] },
        ],
      },
      {
        code: '043400000',
        name: 'Laguna',
        cities: [
          { code: '043403000', name: 'Biñan City', zipCode: '4024', barangays: ['Canlalay', 'Casile', 'De La Paz', 'Ganado', 'Langkiwa', 'Malaban', 'Malamig', 'Mampalasan', 'Platero', 'Poblacion', 'San Antonio', 'San Francisco', 'San Vicente', 'Santo Tomas', 'Tubigan', 'Zapote'] },
          { code: '043401000', name: 'Calamba City', zipCode: '4027', barangays: ['Bagong Kalsada', 'Bañadero', 'Barandal', 'Batino', 'Canlubang', 'Halang', 'Lawa', 'Makiling', 'Milagrosa', 'Parian', 'Poblacion 1', 'Real', 'Turbina'] },
          { code: '043404000', name: 'San Pedro City', zipCode: '4023', barangays: ['Bagong Silang', 'Calendola', 'Cuyab', 'Estrella', 'Fatima', 'GSIS', 'Landayan', 'Laram', 'Magsaysay', 'Narra', 'Pacita 1', 'Pacita 2', 'Poblacion', 'Riverside', 'San Antonio', 'San Roque', 'San Vicente', 'Santo Niño', 'United Bayanihan'] },
          { code: '043402000', name: 'Santa Rosa City', zipCode: '4026', barangays: ['Aplaya', 'Balibago', 'Caingin', 'Dila', 'Dita', 'Don Jose', 'Ibaba', 'Labas', 'Macabling', 'Malitlit', 'Market Area', 'Pooc', 'Sinalhan', 'Tagapo'] },
        ],
      },
      {
        code: '045600000',
        name: 'Quezon',
        cities: [
          { code: '045601000', name: 'Lucena City', zipCode: '4301', barangays: ['Barangay 1 (Poblacion)', 'Barangay 5', 'Barangay 10', 'Bocohan', 'Cotta', 'Dalahican', 'Gulang-Gulang', 'Ibabang Dupay', 'Ibabang Iyam', 'Ilayang Dupay', 'Ilayang Iyam', 'Isabang', 'Market View', 'Mayao Crossing', 'Ransohan', 'Talao-Talao'] },
        ],
      },
      {
        code: '045800000',
        name: 'Rizal',
        cities: [
          { code: '045801000', name: 'Antipolo City', zipCode: '1870', barangays: ['Bagong Nayon', 'Beverly Hills', 'Calawis', 'Cupang', 'Dalig', 'De La Paz', 'Inarawan', 'Mambugan', 'Mayamot', 'Muntindilaw', 'San Isidro', 'San Jose', 'San Juan', 'San Luis', 'San Roque', 'Santa Cruz'] },
          { code: '045802000', name: 'Cainta', zipCode: '1900', barangays: ['San Andres', 'San Isidro', 'San Juan', 'San Roque', 'Santa Rosa', 'Santo Domingo', 'Santo Niño'] },
          { code: '045803000', name: 'Taytay', zipCode: '1920', barangays: ['Dolores (Poblacion)', 'Muzon', 'San Isidro', 'San Juan', 'Santa Ana'] },
        ],
      },
    ],
  },

  // 7. MIMAROPA (Region IV-B)
  {
    code: '170000000',
    name: 'MIMAROPA Region (Region IV-B)',
    shortName: 'MIMAROPA',
    provinces: [
      {
        code: '175100000',
        name: 'Occidental Mindoro',
        cities: [
          { code: '175101000', name: 'San Jose', zipCode: '5100', barangays: ['Bagong Sikat', 'Bubog', 'Caminawit', 'Labangan Poblacion', 'Magbay', 'Mapaya', 'Pag-asa', 'San Roque', 'Santo Niño'] },
        ],
      },
      {
        code: '175200000',
        name: 'Oriental Mindoro',
        cities: [
          { code: '175201000', name: 'Calapan City', zipCode: '5200', barangays: ['Balingayan', 'Biga', 'Canubing I', 'Guinobatan', 'Ibaba East', 'Ibaba West', 'Ilaya', 'Lalud', 'Lumangbayan', 'Poblacion', 'San Vicente Central', 'Sapul', 'Suqui', 'Tawiran'] },
        ],
      },
      {
        code: '175300000',
        name: 'Palawan',
        cities: [
          { code: '175301000', name: 'Puerto Princesa City', zipCode: '5300', barangays: ['Bacungan', 'Bagong Pag-Asa', 'Bancao-Bancao', 'Cabayugan', 'Irawan', 'Manduriao', 'Milagrosa', 'Model', 'Napsan', 'Poblacion', 'San Jose', 'San Manuel', 'San Miguel', 'San Pedro', 'Santa Lourdes', 'Santa Monica', 'Tagburos', 'Tiniguiban'] },
        ],
      },
    ],
  },

  // 8. Region V
  {
    code: '050000000',
    name: 'Region V (Bicol Region)',
    shortName: 'Region V',
    provinces: [
      {
        code: '050500000',
        name: 'Albay',
        cities: [
          { code: '050501000', name: 'Legazpi City', zipCode: '4500', barangays: ['Bagumbayan', 'Bitano', 'Bogtong', 'Bonot', 'Cabid-an', 'Cruzada', 'Dap-dap', 'Gogon', 'Imperial Court Subd.', 'Oro Site', 'Pinaric', 'Rawis', 'Sagpon', 'San Roque', 'Tamaoyan', 'Victory Village'] },
        ],
      },
      {
        code: '051700000',
        name: 'Camarines Sur',
        cities: [
          { code: '051701000', name: 'Naga City', zipCode: '4400', barangays: ['Abella', 'Bagumbayan Norte', 'Bagumbayan Sur', 'Balatas', 'Calauag', 'Cararayan', 'Concepcion Grande', 'Concepcion Pequeña', 'Dayangdang', 'Dinaga', 'Igualdad Interior', 'Lerma', 'Liboton', 'Mabolo', 'Pacol', 'Panicuason', 'Peñafrancia', 'Sabang', 'San Felipe', 'San Francisco', 'Santa Cruz', 'Tabuco', 'Tinago', 'Triangulo'] },
        ],
      },
    ],
  },

  // 9. Region VI
  {
    code: '060000000',
    name: 'Region VI (Western Visayas)',
    shortName: 'Region VI',
    provinces: [
      {
        code: '063000000',
        name: 'Iloilo',
        cities: [
          { code: '063001000', name: 'Iloilo City', zipCode: '5000', barangays: ['City Proper', 'Jaro', 'La Paz', 'Lapuz', 'Mandurriao', 'Molo', 'Villa Arevalo', 'Bolilao', 'Calumpang', 'Dungon A', 'Dungon B', ' Guzman-Jesena', 'Hibao-an Norte', 'Jalandoni Estate', 'Kauswagan', 'MH del Pilar', 'San Isidro', 'San Rafael', 'Tabuc Suba', 'Tagbac'] },
        ],
      },
      {
        code: '064500000',
        name: 'Negros Occidental',
        cities: [
          { code: '064501000', name: 'Bacolod City', zipCode: '6100', barangays: ['Alangilan', 'Alijis', 'Banago', 'Bata', 'Cabug', 'Estefania', 'Felisa', 'Granada', 'Handumanan', 'Mandalagan', 'Mansilingan', 'Montevista', 'Pahanocoy', 'Punta Taytay', 'Singcang-Airport', 'Sum-ag', 'Taculing', 'Tangub', 'Villamonte', 'Vista Alegre'] },
        ],
      },
    ],
  },

  // 10. Region VII
  {
    code: '070000000',
    name: 'Region VII (Central Visayas)',
    shortName: 'Region VII',
    provinces: [
      {
        code: '071200000',
        name: 'Bohol',
        cities: [
          { code: '071201000', name: 'Tagbilaran City', zipCode: '6300', barangays: ['Bool', 'Booy', 'Cabawan', 'Cogon', 'Dao', 'Dampas', 'Manga', 'Mansasa', 'Poblacion I', 'Poblacion II', 'Poblacion III', 'San Isidro', 'Taloto', 'Tiptip', 'Ubujan'] },
        ],
      },
      {
        code: '072200000',
        name: 'Cebu',
        cities: [
          { code: '072201000', name: 'Cebu City', zipCode: '6000', barangays: ['Apas (IT Park)', 'Banilad', 'Basak San Nicolas', 'Busay', 'Capitol Site', 'Guadalupe', 'Inayawan', 'Kasambagan', 'Lahug', 'Mabolo', 'Pardo', 'Punta Princesa', 'Sambag I', 'Sambag II', 'Talamban', 'Tisa', 'Zapatera'] },
          { code: '072202000', name: 'Lapu-Lapu City', zipCode: '6015', barangays: ['Basak', 'Buaya', 'Canjulao', 'Gun-ob', 'Ibo', 'Mactan', 'Maribago', 'Marigondon', 'Pajac', 'Pajo', 'Poblacion', 'Punta Engaño', 'Subabasbas'] },
          { code: '072203000', name: 'Mandaue City', zipCode: '6014', barangays: ['Alang-alang', 'Bakilid', 'Banilad', 'Basak', 'Cabancalan', 'Cambaro', 'Canduman', 'Casuntingan', 'Centro (Poblacion)', 'Guizo', 'Ibabao-Estancia', 'Jagobiao', 'Labogon', 'Looc', 'Maguikay', 'Mantuyong', 'Opao', 'Pakna-an', 'Pagsabungan', 'Subangdaku', 'Tabok', 'Tawason', 'Tingub', 'Tipolo', 'Umapad'] },
          { code: '072204000', name: 'Talisay City', zipCode: '6045', barangays: ['Bulacao', 'Candulawan', 'Cansojong', 'Dumlog', 'Jaclupan', 'Lawaan I', 'Lawaan II', 'Lawaan III', 'Linao', 'Maghaway', 'Manipis', 'Mohon', 'Poblacion', 'Pooc', 'San Isidro', 'San Roque', 'Tabunoc', 'Tangke', 'Tapul'] },
        ],
      },
    ],
  },

  // 11. Region VIII
  {
    code: '080000000',
    name: 'Region VIII (Eastern Visayas)',
    shortName: 'Region VIII',
    provinces: [
      {
        code: '083700000',
        name: 'Leyte',
        cities: [
          { code: '083701000', name: 'Tacloban City', zipCode: '6500', barangays: ['Abucay', 'Bagacay', 'Cabalawan', 'Caibaan', 'Calanipawan', 'Campetic', 'Downtown (Poblacion)', 'Marasbaras', 'Naga-Naga', 'New Bus Terminal', 'Nula-Tula', 'Palanog', 'Sagkahan', 'San Jose', 'Santa Elena', 'Santo Niño', 'Taguik', 'Utap', 'V&G Subdivision'] },
          { code: '083702000', name: 'Ormoc City', zipCode: '6541', barangays: ['Alta Vista', 'Cani-on', 'Cogon', 'Districts 1-29', 'Ipil', 'Linao', 'Naungan', 'Punta', 'San Pablo', 'Tambulilid', 'Valencia'] },
        ],
      },
    ],
  },

  // 12. Region IX
  {
    code: '090000000',
    name: 'Region IX (Zamboanga Peninsula)',
    shortName: 'Region IX',
    provinces: [
      {
        code: '097300000',
        name: 'Zamboanga del Sur',
        cities: [
          { code: '097301000', name: 'Pagadian City', zipCode: '7016', barangays: ['Balangasan', 'Balintawak', 'Danlugan', 'Dao', 'Gatas', 'Kawit', 'Lumbia', 'Poblacion', 'San Francisco', 'San Jose', 'San Pedro', 'Santa Lucia', 'Santo Niño', 'Tiguma', 'Tuburan'] },
          { code: '097302000', name: 'Zamboanga City', zipCode: '7000', barangays: ['Ayala', 'Baliwasan', 'Boalan', 'Calarian', 'Camino Nuevo', 'Canelar', 'Divisoria', 'Guiwan', 'Mercedes', 'Pasonanca', 'Poblacion', 'Putik', 'San Jose Cawa-Cawa', 'San Jose Gusu', 'San Roque', 'Santa Maria', 'Sinunuc', 'Sta. Barbara', 'Sta. Catalina', 'Tetuan', 'Tugbungan', 'Tumaga', 'Vitali'] },
        ],
      },
    ],
  },

  // 13. Region X
  {
    code: '100000000',
    name: 'Region X (Northern Mindanao)',
    shortName: 'Region X',
    provinces: [
      {
        code: '101300000',
        name: 'Bukidnon',
        cities: [
          { code: '101301000', name: 'Malaybalay City', zipCode: '8700', barangays: ['Aglayan', 'Bancud', 'Canayan', 'Casisang', 'Impalambong', 'Kalusayan', 'Kalasungay', 'Linabo', 'Magsaysay', 'Poblacion', 'San Jose', 'Sumpong'] },
          { code: '101302000', name: 'Valencia City', zipCode: '8709', barangays: ['Bagontaas', 'Banlag', 'Batangan', 'Catumbalon', 'Colonia', 'Concepcion', 'Guinoyoran', 'Kahaponan', 'Laligan', 'Lilingayon', 'Lourdes', 'Lumbayao', 'Mailag', 'Mount Nebo', 'Pinatilan', 'Poblacion', 'San Carlos', 'Sugod', 'Tugaya'] },
        ],
      },
      {
        code: '104300000',
        name: 'Misamis Oriental',
        cities: [
          { code: '104301000', name: 'Cagayan de Oro City', zipCode: '9000', barangays: ['Balulang', 'Bulua', 'Camaman-an', 'Canitoan', 'Carmen', 'Consolacion', 'Gusa', 'Iponan', 'Kauswagan', 'Lapasan', 'Macabalan', 'Macasandig', 'Nazareth', 'Patag', 'Poblacion (Barangays 1-40)', 'Puerto', 'Puntod', 'Tablon', 'Upper Carmen'] },
        ],
      },
    ],
  },

  // 14. Region XI
  {
    code: '110000000',
    name: 'Region XI (Davao Region)',
    shortName: 'Region XI',
    provinces: [
      {
        code: '112300000',
        name: 'Davao del Norte',
        cities: [
          { code: '112301000', name: 'Panabo City', zipCode: '8105', barangays: ['Cacao', 'Cagangohan', 'Gredu (Poblacion)', 'J.P. Laurel', 'Little Panay', 'Maduao', 'New Pandan', 'Quezon', 'Salvacion', 'San Francisco', 'San Pedro', 'Santo Niño', 'Tagpore'] },
          { code: '112302000', name: 'Tagum City', zipCode: '8100', barangays: ['Apokon', 'Bincungan', 'Canocotan', 'Cuambogan', 'La Filipina', 'Magdum', 'Mankilam', 'New Balamban', 'Pandapan', 'Poblacion', 'San Agustin', 'San Isidro', 'San Miguel', 'Visayan Village'] },
        ],
      },
      {
        code: '112400000',
        name: 'Davao del Sur',
        cities: [
          {
            code: '112401000',
            name: 'Davao City',
            zipCode: '8000',
            barangays: [
              'Acacia', 'Agdao', 'Alambre', 'Angalan', 'Atan-Awe', 'Bago Aplaya', 'Bago Gallera', 'Bago Oshiro', 'Bangkas Heights', 'Bantol', 'Baracatan', 'Bato', 'Bayabas', 'Biao Escuela', 'Biao Guianga', 'Biao Joaquin', 'Binugao', 'Bucana', 'Buda', 'Buhangin Proper', 'Bunawan Proper',
              'Cabantian', 'Cadalian', 'Calinan Proper', 'Callawa', 'Camansi', 'Catalunan Grande', 'Catalunan Pequeño', 'Catigan', 'Cawayan', 'Centro (San Juan)', 'Colosas', 'Communal', 'Crossing Bayabas', 'Dacudao', 'Dalag', 'Dalagdag', 'Daliao', 'Daliaon Plantation', 'Dumoy',
              'Eden', 'Fatima (Benowang)', 'Gatungan', 'Gov. Paciano Bangoy', 'Gov. Vicente Duterte', 'Gumalang', 'Ilang', 'Inayangan', 'Indangan', 'Kap. Tomas Monteverde Sr.', 'Kilate', 'Lacson', 'Lamanan', 'Lampianao', 'Langub', 'Lapu-Lapu', 'Leon Garcia Sr.', 'Lizada', 'Los Amigos', 'Lubogan',
              'Maa', 'Mabuhay', 'Magsaysay', 'Magtuod', 'Mahayag', 'Malabog', 'Malagos', 'Malamba', 'Manambulan', 'Mandug', 'Manuel Guianga', 'Mapula', 'Marapangi', 'Marilog Proper', 'Matina Aplaya', 'Matina Biao', 'Matina Crossing', 'Matina Pangi', 'Megkawayan', 'Mintal', 'Mudiang', 'Mulig',
              'New Carmen', 'New Valencia', 'Pampanga', 'Panacan Proper', 'Panalum', 'Pandaitan', 'Pangyan', 'Paquibato Proper', 'Piapi', 'Poblacion District', 'Rafael Castillo', 'Riverside', 'Salapawan', 'Salaysay', 'Saloy', 'San Antonio', 'San Isidro', 'Sasao', 'Sasa', 'Sirawan', 'Sirib',
              'Suawan', 'Subasta', 'Sumimao', 'Tacunan', 'Tagakpan', 'Tagluno', 'Tagurano', 'Talandang', 'Talomo Proper', 'Tamayong', 'Tambobong', 'Tamugan', 'Tapak', 'Tawan-Tawan', 'Tibungco', 'Tigatto', 'Toril Proper', 'Tugbok Proper', 'Tungakalan', 'Ubalde', 'Ula', 'Vicente Hizon Sr.', 'Waan', 'Wangan', 'Wines'
            ],
          },
          { code: '112402000', name: 'Digos City', zipCode: '8002', barangays: ['Aplaya', 'Balabag', 'Cogon', 'Colorado', 'Dawis', 'Dulangan', 'Goma', 'Igpit', 'Kiagot', 'Lungag', 'Mahayahay', 'Matti', 'Ruparan', 'San Agustin', 'San Jose', 'San Miguel', 'San Roque', 'Sinawilan', 'Soong', 'Tiguman', 'Tres de Mayo', 'Zone 1 (Poblacion)', 'Zone 2', 'Zone 3'] },
        ],
      },
      {
        code: '112500000',
        name: 'Davao Oriental',
        cities: [
          { code: '112501000', name: 'Mati City', zipCode: '8200', barangays: ['Badas', 'Bobon', 'Central (Poblacion)', 'Culian', 'Dahican', 'Dawan', 'Lantawan', 'Libudon', 'Luban', 'Macambol', 'Matiao', 'Mayo', 'Sainz', 'San Antonio', 'Sanghay', 'Tagabakid', 'Tagbinonga', 'Taguibo', 'Tamisan'] },
        ],
      },
    ],
  },

  // 15. Region XII
  {
    code: '120000000',
    name: 'Region XII (SOCCSKSARGEN)',
    shortName: 'SOCCSKSARGEN',
    provinces: [
      {
        code: '124700000',
        name: 'Cotabato (North Cotabato)',
        cities: [
          { code: '124701000', name: 'Kidapawan City', zipCode: '9400', barangays: ['Amas', 'Balindog', 'Balogo', 'Birada', 'Kalaisan', 'Katipunan', 'Lanao', 'Linangcob', 'Manongol', 'Mateo', 'Nuangan', 'Paco', 'Poblacion', 'San Roque', 'Singao', 'Sudapin'] },
        ],
      },
      {
        code: '126300000',
        name: 'South Cotabato',
        cities: [
          { code: '126301000', name: 'General Santos City', zipCode: '9500', barangays: ['Apopong', 'Baluan', 'Batomelong', 'Buayan', 'Bula', 'Calumpang', 'City Heights', 'Conel', 'Dadiangas East', 'Dadiangas North', 'Dadiangas South', 'Dadiangas West', 'Katangawan', 'Labangal', 'Lagao', 'Ligaya', 'Mabuhay', 'San Isidro', 'San Jose', 'Sinawal', 'Tambler', 'Tinagacan', 'Upper Labay'] },
          { code: '126302000', name: 'Koronadal City', zipCode: '9506', barangays: ['Assumption', 'Avanceña', 'Caloocan', 'Carpenter Hill', 'Concepcion', 'General Paulino Santos', 'Mabini', 'Magsaysay', 'Morales', 'Paraiso', 'Poblacion', 'San Isidro', 'San Jose', 'San Roque', 'Santa Cruz', 'Santo Niño', 'Saravia', 'Zone I', 'Zone II', 'Zone III', 'Zone IV'] },
        ],
      },
    ],
  },

  // 16. Region XIII
  {
    code: '160000000',
    name: 'Region XIII (Caraga)',
    shortName: 'Caraga',
    provinces: [
      {
        code: '160200000',
        name: 'Agusan del Norte',
        cities: [
          { code: '160201000', name: 'Butuan City', zipCode: '8600', barangays: ['Agusan Pequeño', 'Ampayon', 'Baan Riverside', 'Baan KM 3', 'Bading', 'Bancasi', 'Bayanihan', 'Bonbon', 'Dagohoy', 'Doongan', 'Golden Ribbon', 'Holy Redeemer', 'Impalambong', 'Kinamlutan', 'Libertad', 'Limaha', 'Los Angeles', 'Obrero', 'Pangabugan', 'Poblacion', 'San Ignacio', 'San Vicente', 'Taguibo', 'Villa Kananga'] },
          { code: '160202000', name: 'Cabadbaran City', zipCode: '8605', barangays: ['Bay-ang', 'Cabinet', 'Calamba', 'Calibunan', 'Comagascas', 'Kauswagan', 'La Union', 'Mabini', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9', 'Poblacion 10', 'Poblacion 11', 'Poblacion 12', 'Puting Bato', 'San Antonio', 'Tolosa'] },
        ],
      },
      {
        code: '166800000',
        name: 'Surigao del Norte',
        cities: [
          { code: '166801000', name: 'Surigao City', zipCode: '8400', barangays: ['Cagdianao', 'Canlanipa', 'Ipil', 'Lipata', 'Luna', 'Mabua', 'Mabini', 'Mat-i', 'Navarro', 'Poctoy', 'Rizal', 'Sabang', 'San Juan', 'San Roque', 'Taft', 'Washington', 'Zaragoza'] },
        ],
      },
    ],
  },

  // 17. BARMM
  {
    code: '190000000',
    name: 'Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)',
    shortName: 'BARMM',
    provinces: [
      {
        code: '193800000',
        name: 'Maguindanao del Norte',
        cities: [
          { code: '193801000', name: 'Cotabato City', zipCode: '9600', barangays: ['Bagua Mother', 'Kalanganan Mother', 'Poblacion Mother', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9', 'Rosary Heights Mother', 'Rosary Heights 1', 'Rosary Heights 2', 'Rosary Heights 3', 'Tamontaka Mother'] },
        ],
      },
      {
        code: '193600000',
        name: 'Lanao del Sur',
        cities: [
          { code: '193601000', name: 'Marawi City', zipCode: '9700', barangays: ['Banggolo Poblacion', 'Basak Malutlut', 'Bubonga Lilod', 'Calocan East', 'Daguduban', 'Datu Saber', 'Guimba', 'Kilala', 'Lomidong', 'Marawi Poblacion', 'Matampay', 'Moncado Colony', 'Norhaya Village', 'Pugaan', 'Rapas', 'Raya Madaya', 'Sabun', 'Sagonsongan', 'Tuka'] },
        ],
      },
    ],
  },
];
