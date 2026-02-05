const PRODUTOS = [
  {
    "codigo": "AM240LI",
    "nome": "AMINOVITA 240g LIMÃO",
    "embalagem": 12,
    "preco": 159.0
  },
  {
    "codigo": "AM240MR",
    "nome": "AMINOVITA POTE 240G MARACUJÁ",
    "embalagem": 12,
    "preco": 159.0
  },
  {
    "codigo": "AM30LI",
    "nome": "AMINOVITA 30 SACHES 10G LIMAO",
    "embalagem": 6,
    "preco": 220.0
  },
  {
    "codigo": "AM30MR",
    "nome": "AMINOVITA 30 SACHES 10G MARACUJÁ",
    "embalagem": 6,
    "preco": 220.0
  },
  {
    "codigo": "AGF30",
    "nome": "ARGINOFOR 30 CAPSULAS 780mg",
    "embalagem": 6,
    "preco": 64.0
  },
  {
    "codigo": "AGF60",
    "nome": "ARGINOFOR 60 CAPSULAS 780mg",
    "embalagem": 6,
    "preco": 105.0
  },
  {
    "codigo": "AGF120",
    "nome": "ARGINOFOR 120 CAPSULAS 780mg",
    "embalagem": 6,
    "preco": 158.0
  },
  {
    "codigo": "BF210LI",
    "nome": "BCAA FORT 210G LIMAO",
    "embalagem": 12,
    "preco": 107.0
  },
  {
    "codigo": "BF210TA",
    "nome": "BCAA FORT 210G TANGERINA",
    "embalagem": 12,
    "preco": 107.0
  },
  {
    "codigo": "BF120",
    "nome": "BCAA FORT 120 CÁPSULAS 950mg",
    "embalagem": 6,
    "preco": 115.0
  },
  {
    "codigo": "BA120",
    "nome": "BETA ALANINA 120 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 88.0
  },
  {
    "codigo": "BA240",
    "nome": "BETA ALANINA 240 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 164.0
  },
  {
    "codigo": "BAP120",
    "nome": "BETA ALANINA POTE 120g",
    "embalagem": 12,
    "preco": 86.0
  },
  {
    "codigo": "BM30",
    "nome": "BORAPRIM 30 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 67.0
  },
  {
    "codigo": "BM60",
    "nome": "BORAPRIM 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 116.0
  },
  {
    "codigo": "CCF240",
    "nome": "CHOCO FAMILY POUCH 240G",
    "embalagem": 6,
    "preco": 58.0
  },
  {
    "codigo": "CLK300AB",
    "nome": "COLAGENTEK POTE 300g ABACAXI",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300LA",
    "nome": "COLAGENTEK POTE 300g LARANJA COM ACEROLA",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300LI",
    "nome": "COLAGENTEK POTE 300g LIMAO",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300N",
    "nome": "COLAGENTEK POTE 300g NEUTRO",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300MV",
    "nome": "COLAGENTEK POTE 300g MACA VERDE",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300TA",
    "nome": "COLAGENTEK POTE 300g TANGERINA",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK300CR",
    "nome": "COLAGENTEK POTE 300g CRANBERRY",
    "embalagem": 12,
    "preco": 124.0
  },
  {
    "codigo": "CLK30S",
    "nome": "COLAGENTEK 30 SACHÊS DE 10g - SORTIDOS",
    "embalagem": 6,
    "preco": 230.0
  },
  {
    "codigo": "CLB30AH",
    "nome": "COLAGENTEK BEAUTY 30 SACHES DE 3,5g ABACAXI COM HORTELA",
    "embalagem": 6,
    "preco": 169.0
  },
  {
    "codigo": "CLB30MC",
    "nome": "COLAGENTEK BEAUTY 30 SACHES DE 3,5g MACA COM CANELA",
    "embalagem": 6,
    "preco": 169.0
  },
  {
    "codigo": "CG30",
    "nome": "COLAGENTEK TIPO II 30 CAPSULAS 790MG",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "CG60",
    "nome": "COLAGENTEK TIPO II 60 CAPSULAS 790MG",
    "embalagem": 6,
    "preco": 136.0
  },
  {
    "codigo": "CG120",
    "nome": "COLAGENTEK TIPO II 120 CAPSULAS 790MG",
    "embalagem": 6,
    "preco": 240.0
  },
  {
    "codigo": "CKP460MO",
    "nome": "COLAGENTEK PROTEIN LATA 460g SABOR MORANGO",
    "embalagem": 6,
    "preco": 258.0
  },
  {
    "codigo": "CKP460N",
    "nome": "COLAGENTEK PROTEIN LATA 460g SABOR NEUTRO",
    "embalagem": 6,
    "preco": 258.0
  },
  {
    "codigo": "CKP460CA",
    "nome": "COLAGENTEK PROTEIN LATA 460g SABOR CACAU",
    "embalagem": 6,
    "preco": 258.0
  },
  {
    "codigo": "CKP460TA",
    "nome": "COLAGENTEK PROTEIN LATA 460g SABOR TANGERINA",
    "embalagem": 6,
    "preco": 258.0
  },
  {
    "codigo": "CQ30",
    "nome": "COENZIMA Q10  30 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 109.0
  },
  {
    "codigo": "CQ60",
    "nome": "COENZIMA Q10  60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 172.0
  },
  {
    "codigo": "CQ120",
    "nome": "COENZIMA Q10  120 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 299.0
  },
  {
    "codigo": "COQ60",
    "nome": "COENZIMA Q10 60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 109.0
  },
  {
    "codigo": "CLF120",
    "nome": "COLOSFORT POTE 120G",
    "embalagem": 12,
    "preco": 348.0
  },
  {
    "codigo": "CLF30",
    "nome": "COLOSFORT LACTOFERRIN PLUS 30 CÁPSULAS DE 400mg",
    "embalagem": 6,
    "preco": 224.0
  },
  {
    "codigo": "CE100",
    "nome": "CREATINE POTE 100g",
    "embalagem": 12,
    "preco": 48.0
  },
  {
    "codigo": "CE300",
    "nome": "CREATINE POTE 300g",
    "embalagem": 12,
    "preco": 109.0
  },
  {
    "codigo": "CE600",
    "nome": "CREATINE POUCH 600g",
    "embalagem": 4,
    "preco": 198.0
  },
  {
    "codigo": "CR300",
    "nome": "CREAFORT POTE 300g",
    "embalagem": 12,
    "preco": 259.0
  },
  {
    "codigo": "CR30",
    "nome": "CREAFORT CAIXA 30 SACHES 3g",
    "embalagem": 6,
    "preco": 120.0
  },
  {
    "codigo": "CMP30",
    "nome": "CURCUMA PLUS 30 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 69.0
  },
  {
    "codigo": "CMP60",
    "nome": "CURCUMA PLUS 60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 109.0
  },
  {
    "codigo": "DR150",
    "nome": "D RIBOSE POTE 150G",
    "embalagem": 12,
    "preco": 148.0
  },
  {
    "codigo": "EG12LI",
    "nome": "END CAFFEINE GEL 12 SACHES DE 30g LIMAO",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12MC",
    "nome": "END CAFFEINE GEL 12 SACHES DE 30g MOCHA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12CB",
    "nome": "END CAFFEINE GEL 12 SACHES DE 30g CHOCOLATE BELGA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12BN",
    "nome": "END ENERGY GEL 12 SACHES DE 30g BANANA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12BA",
    "nome": "END ENERGY GEL 12 SACHES DE 30g BAUNILHA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12TA",
    "nome": "END ENERGY GEL 12 SACHES DE 30g TANGERINA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EG12PA",
    "nome": "END ENERGY GEL 12 SACHÊS 30G PAÇOCA",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "EXE1000AB",
    "nome": "ENDURANCE EXTREME ENERGY POTE 1000G ABACAXI",
    "embalagem": 6,
    "preco": 158.0
  },
  {
    "codigo": "EXE1000LA",
    "nome": "ENDURANCE EXTREME ENERGY POTE 1000G LARANJA",
    "embalagem": 6,
    "preco": 158.0
  },
  {
    "codigo": "EZ10",
    "nome": "ENZYFOR 10 SACHES 3g",
    "embalagem": 12,
    "preco": 89.0
  },
  {
    "codigo": "EZ30",
    "nome": "ENZYFOR 30 SACHES 3g",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "FEP30",
    "nome": "FERRO PLUS 30 CÁPSULAS 500mg",
    "embalagem": 6,
    "preco": 42.0
  },
  {
    "codigo": "FBF10",
    "nome": "FIBERFOR 10 SACHES DE 5g",
    "embalagem": 12,
    "preco": 40.0
  },
  {
    "codigo": "FBF400",
    "nome": "FIBERFOR POTE COM 400g",
    "embalagem": 6,
    "preco": 126.0
  },
  {
    "codigo": "FV250",
    "nome": "FOSVITA 250g",
    "embalagem": 12,
    "preco": 99.0
  },
  {
    "codigo": "FV30",
    "nome": "FOSVITA 30 SACHES 7g",
    "embalagem": 6,
    "preco": 138.0
  },
  {
    "codigo": "FZ12BF",
    "nome": "FITZEI DISPLAY C/ 12 BARRAS 40G BANOFFE",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "FZ12FV",
    "nome": "FITZEI DISPLAY C/ 12 BARRAS 40G FRUTAS VERMELHAS",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "FZ12PA",
    "nome": "FITZEI DISPLAY C/ 12 BARRAS 40G PACOCA",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "FZ12CO",
    "nome": "FITZEI DISPLAY C/ 12 BARRAS 40G COCO",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "FZ12CA",
    "nome": "FITZEI DISPLAY C/ 12 BARRAS 40G CARAMELO E AMENDOIM",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "FZS45CG",
    "nome": "FITZEI SNACK PACOTE 45g CRISPY GARLIC",
    "embalagem": 10,
    "preco": 9.98
  },
  {
    "codigo": "FZS45CH",
    "nome": "FITZEI SNACK PACOTE 45g CHURRASCO",
    "embalagem": 10,
    "preco": 9.98
  },
  {
    "codigo": "FZS45EFQ",
    "nome": "FITZEI SNACK PACOTE 45g ERVAS FINAS COM QUEIJO",
    "embalagem": 10,
    "preco": 9.98
  },
  {
    "codigo": "MTS90",
    "nome": "GLP-1 MULTIVITAMÍNICO 90 CÁPSULAS 620mg",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "GM150",
    "nome": "GLUTAMAX POTE 150g",
    "embalagem": 12,
    "preco": 70.0
  },
  {
    "codigo": "GM300",
    "nome": "GLUTAMAX POTE 300g",
    "embalagem": 12,
    "preco": 116.0
  },
  {
    "codigo": "GMS30",
    "nome": "GLUTAMAX 30 SACHES 5g",
    "embalagem": 6,
    "preco": 128.0
  },
  {
    "codigo": "GM30",
    "nome": "GLUTAMAX 30 SACHES 10g",
    "embalagem": 6,
    "preco": 184.0
  },
  {
    "codigo": "GM600",
    "nome": "GLUTAMAX POUCH 600G",
    "embalagem": 6,
    "preco": 178.0
  },
  {
    "codigo": "HF60",
    "nome": "HEPATOFOR 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 116.0
  },
  {
    "codigo": "HH60",
    "nome": "HYALURONIC HAIR 60 CÁPSULAS 500MG",
    "embalagem": 6,
    "preco": 98.0
  },
  {
    "codigo": "IMT60",
    "nome": "IMUNOMULT MULTIVITAMINICO 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 120.0
  },
  {
    "codigo": "IMT120",
    "nome": "IMUNOMULT MULTIVITAMINICO 120 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 184.0
  },
  {
    "codigo": "ISC60N",
    "nome": "ISOCRISP NEUTRO POTE 60g",
    "embalagem": 12,
    "preco": 62.0
  },
  {
    "codigo": "ISC240N",
    "nome": "ISOCRISP WHEY NEUTRO POUCH 240G",
    "embalagem": 4,
    "preco": 114.0
  },
  {
    "codigo": "ISP60",
    "nome": "ISOCRISP PLANT POTE 60g",
    "embalagem": 12,
    "preco": 33.0
  },
  {
    "codigo": "ISP240",
    "nome": "ISOCRISP PLANT  POUCH 240G",
    "embalagem": 4,
    "preco": 89.0
  },
  {
    "codigo": "ICP240",
    "nome": "ISOCRISP PLANT POTE 240g",
    "embalagem": 12,
    "preco": 91.0
  },
  {
    "codigo": "ISF15BA",
    "nome": "ISOFORT 15 SACHES 30g BAUNILHA",
    "embalagem": 4,
    "preco": 280.0
  },
  {
    "codigo": "ISF15CH",
    "nome": "ISOFORT 15 SACHES 30g CHOCOLATE",
    "embalagem": 4,
    "preco": 280.0
  },
  {
    "codigo": "ISF15FV",
    "nome": "ISOFORT 15 SACHES 30g FRUTAS VERMELHAS",
    "embalagem": 4,
    "preco": 280.0
  },
  {
    "codigo": "ISF15N",
    "nome": "ISOFORT 15 SACHES 30g NEUTRO",
    "embalagem": 4,
    "preco": 280.0
  },
  {
    "codigo": "ISF900BA",
    "nome": "ISOFORT POTE 900g BAUNILHA",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "ISF900CH",
    "nome": "ISOFORT POTE 900g CHOCOLATE",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "ISF900FV",
    "nome": "ISOFORT POTE 900g FRUTAS VERMELHAS",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "ISF900N",
    "nome": "ISOFORT POTE 900g NEUTRO",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "IU900BA",
    "nome": "ISOFORT ULTRA IMUNO POTE 900G BAUNILHA",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "IU900CA",
    "nome": "ISOFORT ULTRA IMUNO POTE 900G CACAU",
    "embalagem": 4,
    "preco": 440.0
  },
  {
    "codigo": "IFP450BC",
    "nome": "ISOFORT PLANT 450g BANANA COM CANELA",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "IFP450CA",
    "nome": "ISOFORT PLANT 450g CACAU",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "IFP450BA",
    "nome": "ISOFORT PLANT 450g BAUNILHA",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "IFP450PA",
    "nome": "ISOFORT PLANT 450g PACOCA",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "IFB450BA",
    "nome": "ISOFORT BEAUTY 450g BAUNILHA",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "IFB450CA",
    "nome": "ISOFORT BEAUTY 450g CACAU",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "IFB450AG",
    "nome": "ISOFORT BEAUTY 450g ABACAXI COM GENGIBRE",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "IFB450CB",
    "nome": "ISOFORT BEAUTY 450g CRANBERRY",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "IFB450N",
    "nome": "ISOFORT BEAUTY 450g NEUTRO",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "IFB15AG",
    "nome": "ISOFORT BEAUTY 15 SACHES 25g ABACAXI COM GENGIBRE",
    "embalagem": 4,
    "preco": 226.0
  },
  {
    "codigo": "IFB15BA",
    "nome": "ISOFORT BEAUTY 15 SACHES 25g BAUNILHA",
    "embalagem": 4,
    "preco": 226.0
  },
  {
    "codigo": "IFB15CA",
    "nome": "ISOFORT BEAUTY 15 SACHES 25g CACAU",
    "embalagem": 4,
    "preco": 226.0
  },
  {
    "codigo": "IFB15CB",
    "nome": "ISOFORT BEAUTY 15 SACHES 25g CRANBERRY",
    "embalagem": 4,
    "preco": 226.0
  },
  {
    "codigo": "IFB15N",
    "nome": "ISOFORT BEAUTY 15 SACHES 25G NEUTRO",
    "embalagem": 4,
    "preco": 226.0
  },
  {
    "codigo": "KV30",
    "nome": "KRILL VIT 30 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "KV60",
    "nome": "KRILL VIT 60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 158.0
  },
  {
    "codigo": "LCZ60",
    "nome": "LACZYME 60 CAPSULAS 470mg",
    "embalagem": 6,
    "preco": 108.0
  },
  {
    "codigo": "LCT60",
    "nome": "L CARNITINA 60 CAPSULAS 530mg",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "LCT120",
    "nome": "L CARNITINA 120 CAPSULAS DE 530mg",
    "embalagem": 6,
    "preco": 144.0
  },
  {
    "codigo": "LP120",
    "nome": "LIPIX 120 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 98.0
  },
  {
    "codigo": "LPS60",
    "nome": "LIPIX 6   60  CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "LPS120",
    "nome": "LIPIX 6 120 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 149.0
  },
  {
    "codigo": "MGP90",
    "nome": "MAGNESIO PLUS 90 CÁPSULAS 690mg",
    "embalagem": 6,
    "preco": 98.0
  },
  {
    "codigo": "MCA250",
    "nome": "MCT COM AGE FRASCO 250ML",
    "embalagem": 6,
    "preco": 98.0
  },
  {
    "codigo": "MCT500",
    "nome": "MCT FRASCO 500ML",
    "embalagem": 6,
    "preco": 196.0
  },
  {
    "codigo": "MD60",
    "nome": "MEGA DHA 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 119.0
  },
  {
    "codigo": "MD120",
    "nome": "MEGA DHA 120 CAPSULAS 1000mg",
    "embalagem": 12,
    "preco": 214.0
  },
  {
    "codigo": "ML20",
    "nome": "MELATONINA GOTAS FRASCO 20ML",
    "embalagem": 32,
    "preco": 58.0
  },
  {
    "codigo": "NAC30",
    "nome": "N ACETIL CISTEINA 30 CAPSULAS 750mg",
    "embalagem": 6,
    "preco": 65.0
  },
  {
    "codigo": "NAC60",
    "nome": "N ACETIL CISTEINA 60 CAPSULAS 750mg",
    "embalagem": 6,
    "preco": 104.0
  },
  {
    "codigo": "OF60",
    "nome": "OMEGA 3 EPA E DHA 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 79.0
  },
  {
    "codigo": "OF120",
    "nome": "OMEGA 3 EPA E DHA 120 CAPSULAS 1000mg",
    "embalagem": 12,
    "preco": 140.0
  },
  {
    "codigo": "OF240",
    "nome": "OMEGA 3 EPA E DHA 240 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 260.0
  },
  {
    "codigo": "OFP60",
    "nome": "OMEGAFOR PLUS 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 132.0
  },
  {
    "codigo": "OFP120",
    "nome": "OMEGAFOR PLUS 120 CAPSULAS 1000mg",
    "embalagem": 12,
    "preco": 218.0
  },
  {
    "codigo": "OFP240",
    "nome": "OMEGAFOR PLUS 240 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 378.0
  },
  {
    "codigo": "OFF60",
    "nome": "OMEGAFOR FAMILY 60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 95.0
  },
  {
    "codigo": "OFF120",
    "nome": "OMEGAFOR FAMILY 120 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "OFF360",
    "nome": "OMEGAFOR FAMILY 360 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 399.0
  },
  {
    "codigo": "OMV60",
    "nome": "OMEGAFOR VISION 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 145.0
  },
  {
    "codigo": "OV60",
    "nome": "OMEGAFOR VEGAN 60 CAPSULAS 700mg",
    "embalagem": 6,
    "preco": 145.0
  },
  {
    "codigo": "OME60",
    "nome": "OMEGAFOR MEMORY 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 148.0
  },
  {
    "codigo": "OFV60",
    "nome": "OMEGAFOR VITAMINS 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 88.0
  },
  {
    "codigo": "OFV120",
    "nome": "OMEGAFOR VITAMINS 120 CAPSULAS 1000mg",
    "embalagem": 12,
    "preco": 154.0
  },
  {
    "codigo": "PA300",
    "nome": "PALATINOSE POTE 300g",
    "embalagem": 12,
    "preco": 69.0
  },
  {
    "codigo": "PA600",
    "nome": "PALATINOSE POUCH 600g",
    "embalagem": 6,
    "preco": 120.0
  },
  {
    "codigo": "PR60",
    "nome": "PROFEM 60 CÁPSULAS 1000mg",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "PL20",
    "nome": "PRÓPOLIS LIQUIDA GOTAS FRASCO 20ml",
    "embalagem": 32,
    "preco": 62.0
  },
  {
    "codigo": "REP60",
    "nome": "RESVERATROL PLUS 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 168.0
  },
  {
    "codigo": "SFM15",
    "nome": "SIMFORT FEMME 15 CÁPSULAS 650mg",
    "embalagem": 6,
    "preco": 78.0
  },
  {
    "codigo": "SFM30",
    "nome": "SIMFORT FEMME 30 CÁPSULAS 650MG",
    "embalagem": 6,
    "preco": 134.0
  },
  {
    "codigo": "SCP30",
    "nome": "SIMCAPS 30 CAPSULAS 400mg",
    "embalagem": 6,
    "preco": 68.0
  },
  {
    "codigo": "SCP60",
    "nome": "SIMCAPS 60 CAPSULAS 400mg",
    "embalagem": 6,
    "preco": 99.0
  },
  {
    "codigo": "SF10",
    "nome": "SIMFORT 10 SACHES 2g",
    "embalagem": 6,
    "preco": 53.0
  },
  {
    "codigo": "SF30",
    "nome": "SIMFORT 30 SACHES 2g",
    "embalagem": 12,
    "preco": 129.0
  },
  {
    "codigo": "SF60",
    "nome": "SIMFORT 60 SACHES 2g",
    "embalagem": 10,
    "preco": 242.0
  },
  {
    "codigo": "SFF210",
    "nome": "SIMFORT FIBRAS 210g",
    "embalagem": 12,
    "preco": 89.0
  },
  {
    "codigo": "SFS10",
    "nome": "SIMFORT PLUS 10 SACHES 2g",
    "embalagem": 12,
    "preco": 53.0
  },
  {
    "codigo": "SFS30",
    "nome": "SIMFORT PLUS 30 SACHES 2g",
    "embalagem": 12,
    "preco": 129.0
  },
  {
    "codigo": "SFP30",
    "nome": "SIMFORT PLUS 30 CÁPSULAS 390mg",
    "embalagem": 6,
    "preco": 89.0
  },
  {
    "codigo": "SFP60",
    "nome": "SIMFORT PLUS 60 CAPSULAS 390mg",
    "embalagem": 6,
    "preco": 158.0
  },
  {
    "codigo": "SFU30",
    "nome": "SIMFORT ULTRA 30 CAPSULAS 390mg",
    "embalagem": 6,
    "preco": 107.0
  },
  {
    "codigo": "SFU60",
    "nome": "SIMFORT ULTRA 60 CAPSULAS 390mg",
    "embalagem": 6,
    "preco": 198.0
  },
  {
    "codigo": "SL30",
    "nome": "SLEEPFOR 30 CAPSULAS 470mg",
    "embalagem": 6,
    "preco": 65.0
  },
  {
    "codigo": "SL60",
    "nome": "SLEEPFOR 60 CAPSULAS 470mg",
    "embalagem": 6,
    "preco": 95.0
  },
  {
    "codigo": "TA30",
    "nome": "TAURINE 30 CAPSULAS 550mg",
    "embalagem": 6,
    "preco": 54.0
  },
  {
    "codigo": "TA60",
    "nome": "TAURINE 60 CAPSULAS 550mg",
    "embalagem": 6,
    "preco": 95.0
  },
  {
    "codigo": "TP240TC",
    "nome": "TERMO PLUS 240G TANGERINA COM CHA VERDE",
    "embalagem": 12,
    "preco": 176.0
  },
  {
    "codigo": "TP240FGC",
    "nome": "TERMO PLUS 240G FRUTAS VERMELHAS COM GENGIBRE E CHÁ VERDE",
    "embalagem": 12,
    "preco": 176.0
  },
  {
    "codigo": "TP30TC",
    "nome": "TERMO PLUS 30 SACHÊS 4G TANGERINA COM CHÁ VERDE",
    "embalagem": 6,
    "preco": 132.0
  },
  {
    "codigo": "TP30FGC",
    "nome": "TERMO PLUS 30 SACHES 4G FRUTAS VERMELHAS E GENGIBRE COM CHÁ VERDE",
    "embalagem": 6,
    "preco": 132.0
  },
  {
    "codigo": "TPC90",
    "nome": "TERMO PLUS 90 CAPSULAS 650mg",
    "embalagem": 6,
    "preco": 108.0
  },
  {
    "codigo": "CFE220OR",
    "nome": "V-COFFEE LATA 220G ORIGINAL",
    "embalagem": 12,
    "preco": 119.0
  },
  {
    "codigo": "VF240FV",
    "nome": "V FORT 240g FRUTAS VERMELHAS",
    "embalagem": 12,
    "preco": 164.0
  },
  {
    "codigo": "VF240LI",
    "nome": "V FORT 240g LIMAO",
    "embalagem": 12,
    "preco": 164.0
  },
  {
    "codigo": "VFU240LI",
    "nome": "V FORT ULTRA POTE 240G LIMAO",
    "embalagem": 12,
    "preco": 164.0
  },
  {
    "codigo": "VTT30",
    "nome": "VITATEA 30 SACHES 2g",
    "embalagem": 12,
    "preco": 94.0
  },
  {
    "codigo": "VTE30",
    "nome": "VITATEA EQUILIBRIUM 30 SACHES DE 2g",
    "embalagem": 12,
    "preco": 94.0
  },
  {
    "codigo": "VB60F",
    "nome": "VITA BEAR 4g 60 GOMAS DE FRUTAS",
    "embalagem": 6,
    "preco": 130.0
  },
  {
    "codigo": "VC60",
    "nome": "VITA C3 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 71.0
  },
  {
    "codigo": "VC120",
    "nome": "VITA C3 120 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 120.0
  },
  {
    "codigo": "VD60",
    "nome": "VITA D3 60 CAPSULAS 500mg",
    "embalagem": 6,
    "preco": 72.0
  },
  {
    "codigo": "VDZ30",
    "nome": "VITA D3 + C + ZINCO 30 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 59.0
  },
  {
    "codigo": "VDZ60",
    "nome": "VITA D3 + C + ZINCO 60 CAPSULAS 1000mg",
    "embalagem": 6,
    "preco": 88.0
  },
  {
    "codigo": "VD10",
    "nome": "VITA D3 GOTAS FRASCO 10 ML",
    "embalagem": 32,
    "preco": 69.0
  },
  {
    "codigo": "VDK20ME",
    "nome": "VITA D3 + K2 GOTAS FRASCO 20ML SABOR MENTA",
    "embalagem": 32,
    "preco": 93.0
  },
  {
    "codigo": "B1220ME",
    "nome": "VITAMINA B12 GOTAS FRASCO 20ML MENTA",
    "embalagem": 32,
    "preco": 49.0
  },
  {
    "codigo": "WFT900BN",
    "nome": "WHEY FORT 3W POTE 900G BANANA",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900BA",
    "nome": "WHEY FORT 3W POTE 900G BAUNILHA",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900CH",
    "nome": "WHEY FORT 3W POTE 900G CHOCOLATE",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900CC",
    "nome": "WHEY FORT 3W POTE 900G COOKIES N CREAM",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900FV",
    "nome": "WHEY FORT 3W POTE 900G FRUTAS VERMELHAS",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900MC",
    "nome": "WHEY FORT 3W POTE 900G MOCHACCINO",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900N",
    "nome": "WHEY FORT 3W POTE 900G NEUTRO",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT900PA",
    "nome": "WHEY FORT 3W POTE 900G PAÇOCA",
    "embalagem": 4,
    "preco": 298.0
  },
  {
    "codigo": "WFT1800BA",
    "nome": "WHEY FORT 3W POTE 1800G BAUNILHA",
    "embalagem": 4,
    "preco": 589.0
  },
  {
    "codigo": "WFT1800CH",
    "nome": "WHEY FORT 3W POTE 1800G CHOCOLATE",
    "embalagem": 4,
    "preco": 589.0
  },
  {
    "codigo": "WPI250",
    "nome": "WHEY PROTEIN ISOLATE 250g",
    "embalagem": 12,
    "preco": 160.0
  },
  {
    "codigo": "WPI15",
    "nome": "WHEY PROTEIN ISOLATE 15 SACHES DE 15g",
    "embalagem": 6,
    "preco": 216.0
  },
  {
    "codigo": "WP900BA",
    "nome": "WHEY PROTEIN WPC POUCH 900G BAUNILHA",
    "embalagem": 4,
    "preco": 197.0
  },
  {
    "codigo": "WP900MO",
    "nome": "WHEY PROTEIN WPC POUCH 900G MORANGO",
    "embalagem": 4,
    "preco": 197.0
  },
  {
    "codigo": "WP900BJ",
    "nome": "WHEY PROTEIN WPC POUCH 900G BEIJINHO",
    "embalagem": 4,
    "preco": 197.0
  },
  {
    "codigo": "WP900MM",
    "nome": "WHEY PROTEIN WPC POUCH 900G MOUSSE DE MARACUJÁ",
    "embalagem": 4,
    "preco": 197.0
  },
  {
    "codigo": "XLF300",
    "nome": "XILITOL FAMILY POUCH 300g",
    "embalagem": 6,
    "preco": 69.0
  }
];
