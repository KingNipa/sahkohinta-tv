# sähkönhinta-tv

Kevyt sähkönhinnan seurantasivu Samsung Smart TV:n selaimeen.
Sovellus on tehty mahdollisimman selkeäksi ja helposti luettavaksi ilman frameworkeja.

## Smart TV -käyttö

1. Avaa GitHub Pages -osoite TV:n selaimessa.
2. Lisää sivu kirjanmerkiksi tai aloitusnäytön pikakuvakkeeksi selaimen valikosta.
3. Kuvakkeena käytetään `icon.svg`-tiedostoa.

## Mitä ruudulla näkyy

- päivä ja nykyinen tunti muodossa `klo 12 - 13: hinta`
- isolla nykyisen tunnin hinta (`snt/kWh`)
- alarivillä päivän halvin, kallein ja keskihinta
- vasemmassa alanurkassa `Päivitetty: HH:MM`
- oikeassa alanurkassa yhteystila (`Yhteys OK` / `Ei yhteyttä - näytetään viimeisin arvo`)

## Näkymän vaihto kaukosäätimellä

- paina mitä tahansa nuolinäppäintä (`↑ ↓ ← →`) vaihtaaksesi näkymää
- seuraava nuolinäppäin palauttaa takaisin
- kaavionäkymässä:
  - halvin tunti näytetään vihreällä
  - kallein tunti näytetään punaisella
  - nykyinen tunti on korostettu

## Datalähde

Oletuksena data haetaan suoraan julkisesta API:sta:

`https://api.spot-hinta.fi/Today`

- API palauttaa hinnat 15 minuutin jaksoissa.
- Sovellus laskee niistä tuntikeskiarvot (snt/kWh), jotta näkymä pysyy yksinkertaisena TV-käytössä.
- Päivitysväli on oletuksena 1 tunti (`refreshMs: 3600000`).

## Kuormitus ja päivityslogiikka

- Sivu ei hae dataa turhaan jokaisella reloadilla.
- Jos viimeisin onnistunut haku on tuore, käytetään localStorage-välimuistia.
- Uusi API-haku tehdään vasta, kun tunnin väli täyttyy.
- UI päivittyy silti paikallisesti (esim. tunnin vaihtuessa), ilman uutta verkkohakua.

## Tiedostot

- `index.html` - näkymän rakenne
- `style.css` - TV:lle suunniteltu ulkoasu
- `app.js` - datan haku, muunnokset, välimuisti, päivityslogiikka ja kaaviorenderöinti
- `mock-price.json` - paikallinen mock-data kehitykseen
- `icon.svg` - kuvake kirjanmerkkiä / pikakuvaketta varten

## Paikallinen ajo

1. Siirry projektikansioon:
   ```bash
   cd sahkohinta-tv
   ```
2. Käynnistä staattinen palvelin:
   ```bash
   python -m http.server 8080
   ```
3. Avaa selaimessa:
   ```text
   http://localhost:8080/
   ```
## Konfiguraatio

`app.js`-tiedoston alussa:

```js
var CONFIG = {
  endpoint: "https://api.spot-hinta.fi/Today",
  refreshMs: 3600000,
  uiTickMs: 30000
};
```

- `endpoint`: mistä data haetaan
- `refreshMs`: verkkohaun väli millisekunteina (`3600000` = 1 h)
- `uiTickMs`: paikallisen UI-päivityksen väli (ei verkkohakua)

Mikäli haluut testata ilman nettiä, vaihda `endpoint` väliaikaisesti:

```js
endpoint: "./mock-price.json"
```

Sovellus tukee myös mock-tiedoston tuntihintamuotoa testausta varten.
