# sahkohinta-tv

Superyksinkertainen TV-näkymä sähkön hinnalle (snt/kWh), tehty ilman frameworkeja Samsung Smart TV -selainta varten.

## Tiedostot

- `index.html` - näkymän rakenne
- `style.css` - TV-ystävällinen ulkoasu
- `app.js` - datan haku, automaattinen päivitys, localStorage-välimuisti
- `mock-price.json` - paikallinen mock-data
- `icon.svg` - kuvake selaimen bookmark/shortcut-käyttöön

## Paikallinen ajo

1. Siirry projektikansioon:
   ```bash
   cd sahkohinta-tv
   ```
2. Käynnistä staattinen palvelin (esim. Python):
   ```bash
   python -m http.server 8080
   ```
3. Avaa selaimessa:
   ```
   http://localhost:8080/
   ```

## GitHub Pages -julkaisu (main branch, root)

1. Pushaa tiedostot `main`-haaraan.
2. Avaa GitHubissa: `Settings` -> `Pages`.
3. Valitse `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/ (root)`
4. Tallenna ja odota julkaisu valmis.
5. Sovellus löytyy osoitteesta:
   ```
   https://<username>.github.io/<repo>/
   ```

## Samsung Smart TV -käyttö

1. Avaa TV:n selaimella julkaistu GitHub Pages -osoite.
2. Lisää sivu kirjanmerkiksi / aloitusnäytön pikakuvakkeeksi selaimen valikosta.
3. Kuvakkeena käytetään tiedostoa `icon.svg`.

## Toiminta

- Hakee hinnan heti sivun latauksessa.
- Päivittää automaattisesti 10 minuutin välein.
- Painike `Päivitä nyt` käynnistää haun heti.
- Jos yhteys epäonnistuu, viimeisin onnistunut arvo pidetään näkyvissä.
- Viimeisin onnistunut arvo tallennetaan `localStorage`en, joten arvo säilyy sivun uudelleenlatauksessa.
- Endpoint on konfiguroitavissa `app.js`-tiedoston alussa:
  ```js
  const CONFIG = { endpoint: "./mock-price.json", refreshMs: 600000 };
  ```
