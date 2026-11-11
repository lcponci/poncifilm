"""Genera le icone PNG dell'app (una bobina di pellicola dorata su fondo scuro).

Usa solo la libreria standard di Python: nessuna installazione necessaria.
Avvio:  python strumenti/genera-icone.py
"""
import math
import pathlib
import struct
import zlib

SFONDO_ALTO = (0x26, 0x29, 0x30)
SFONDO_BASSO = (0x0E, 0x0F, 0x11)
ORO = (0xF2, 0xB5, 0x44)
MISURE = (180, 192, 512)
CARTELLA = pathlib.Path(__file__).resolve().parent.parent / "icone"


def copertura(distanza):
    """Quanto un pixel è coperto da una forma (bordi sfumati, senza scalini)."""
    return max(0.0, min(1.0, 0.5 - distanza))


def mescola(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def disegna(lato):
    c = lato / 2
    raggio = 0.30 * lato
    raggio_foro = 0.072 * lato
    distanza_fori = 0.165 * lato
    raggio_centro = 0.038 * lato
    fori = [
        (c + distanza_fori * math.cos(math.radians(-90 + i * 72)),
         c + distanza_fori * math.sin(math.radians(-90 + i * 72)))
        for i in range(5)
    ]
    dati = bytearray()
    for y in range(lato):
        dati.append(0)  # filtro PNG "nessuno" per la riga
        py = y + 0.5
        sfondo = mescola(SFONDO_ALTO, SFONDO_BASSO, y / (lato - 1))
        for x in range(lato):
            px = x + 0.5
            colore = sfondo
            d = math.hypot(px - c, py - c)
            k = copertura(d - raggio)
            if k > 0:
                colore = mescola(colore, ORO, k)
                buco = copertura(d - raggio_centro)
                for fx, fy in fori:
                    buco = max(buco, copertura(math.hypot(px - fx, py - fy) - raggio_foro))
                if buco > 0:
                    colore = mescola(colore, sfondo, buco)
            dati += bytes(int(round(v)) for v in colore)
    return dati


def salva_png(lato, dati, percorso):
    def blocco(tipo, contenuto):
        crc = zlib.crc32(tipo + contenuto) & 0xFFFFFFFF
        return struct.pack(">I", len(contenuto)) + tipo + contenuto + struct.pack(">I", crc)

    intestazione = struct.pack(">IIBBBBB", lato, lato, 8, 2, 0, 0, 0)
    percorso.write_bytes(
        b"\x89PNG\r\n\x1a\n"
        + blocco(b"IHDR", intestazione)
        + blocco(b"IDAT", zlib.compress(bytes(dati), 9))
        + blocco(b"IEND", b"")
    )


if __name__ == "__main__":
    CARTELLA.mkdir(exist_ok=True)
    for lato in MISURE:
        percorso = CARTELLA / f"icona-{lato}.png"
        salva_png(lato, disegna(lato), percorso)
        print("Creata", percorso.name)
