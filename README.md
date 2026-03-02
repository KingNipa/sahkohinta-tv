# sähkönhinta-tv

Kevyt sähkönhinnan seurantasivu Samsung Smart TV:n selaimeen.
Tavoite on ollut tehdä näkymästä mahdollisimman selkeä ja helposti luettava, ilman frameworkeja tai ulkoisia kirjastoja.

## Mitä ruudulla näkyy

- nykyinen tunti muodossa `klo 12 - 13: hinta`
- isolla nykyisen tunnin hinta (`snt/kWh`)
- alarivillä päivän:
  - halvin hinta (+ tunti)
  - kallein hinta (+ tunti)
  - keskihinta
- vasemmassa alanurkassa `Päivitetty: HH:MM`
- oikeassa alanurkassa yhteystila (`Yhteys OK` / `Ei yhteyttä - näytetään viimeisin arvo`)

## Tiedostot

- `index.html` - näkymän rakenne
- `style.css` - TV:lle suunniteltu ulkoasu
- `app.js` - datan haku, päivityslogiikka, localStorage-välimuisti
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

## Julkaisu GitHub Pagesiin (main + root)

1. Pushaa muutokset:
   ```bash
   git add .
   git commit -m "Päivitä sovellus"
   git push origin main
   ```
2. Avaa GitHubissa `Settings` -> `Pages`.
3. Valitse:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/(root)`
4. Tallenna.
5. Sivun osoite:
   ```text
   https://<username>.github.io/<repo>/
   ```

## Samsung Smart TV -käyttö

1. Avaa GitHub Pages -osoite TV:n selaimessa.
2. Lisää sivu kirjanmerkiksi tai aloitusnäytön pikakuvakkeeksi selaimen valikosta.
3. Kuvakkeena käytetään `icon.svg`-tiedostoa.

## Datan formaatti (mock)

Sovellus odottaa oletuksena endpointista tämän tyyppistä dataa:

```json
{
  "updatedAt": "2026-03-02T12:40:00+02:00",
  "hourlyPrices": [
    { "hour": 0, "centsPerKwh": 8.5 },
    { "hour": 1, "centsPerKwh": 7.2 }
  ]
}
```

- `hour` on kokonaisluku 0-23
- `centsPerKwh` on tunnin hinta sentteinä per kWh

Sovellus toimii myös vanhalla yksittäisen hinnan muodolla (`centsPerKwh`), mutta yhteenveto kannattaa ajaa tuntidatasta.

## Toimintalogiikka

- Hakee datan heti latauksessa.
- Päivittää automaattisesti 10 minuutin välein.
- Tallentaa viimeisimmän onnistuneen datan localStorageen.
- Jos yhteys katkeaa, näytetään viimeisin onnistunut arvo ja offline-status.
- `Päivitetty` näyttää viimeisimmän onnistuneen haun ajan (selaimen paikallinen aika).

## Konfiguraatio

`app.js`-tiedoston alussa:

```js
const CONFIG = { endpoint: "./mock-price.json", refreshMs: 600000 };
```

- `endpoint`: mistä data haetaan
- `refreshMs`: päivitysväli millisekunteina (`600000` = 10 min)
