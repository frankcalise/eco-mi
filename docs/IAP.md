# Eco Mi — In-App Purchase Reference

## Products

| Product ID             | Display Name      | Description                                       | Price | Type           |
| ---------------------- | ----------------- | ------------------------------------------------- | ----- | -------------- |
| `ecomi_remove_ads`     | Remove Ads        | Remove all ads from Eco Mi permanently            | $1.99 | Non-Consumable |
| `ecomi_theme_neon`     | Neon Theme        | Unlock the Neon color theme for your game board   | $0.99 | Non-Consumable |
| `ecomi_theme_retro`    | Retro Theme       | Unlock the Retro color theme for your game board  | $0.99 | Non-Consumable |
| `ecomi_theme_pastel`   | Pastel Theme      | Unlock the Pastel color theme for your game board | $0.99 | Non-Consumable |
| `ecomi_sound_square`   | Retro Sound Pack  | Unlock the retro chiptune sound pack              | $0.99 | Non-Consumable |
| `ecomi_sound_sawtooth` | Buzzy Sound Pack  | Unlock the buzzy sawtooth sound pack              | $0.99 | Non-Consumable |
| `ecomi_sound_triangle` | Mellow Sound Pack | Unlock the mellow triangle wave sound pack        | $0.99 | Non-Consumable |

## RevenueCat Entitlements

| Entitlement ID | Product ID             | Grants                                    |
| -------------- | ---------------------- | ----------------------------------------- |
| `remove_ads`   | `ecomi_remove_ads`     | Hides all AdMob ads                       |
| `theme_neon`   | `ecomi_theme_neon`     | Unlocks Neon theme                        |
| `theme_retro`  | `ecomi_theme_retro`    | Unlocks Retro theme                       |
| `theme_pastel` | `ecomi_theme_pastel`   | Unlocks Pastel theme                      |
| `sound_retro`  | `ecomi_sound_square`   | Unlocks Retro (square wave) sound pack    |
| `sound_buzzy`  | `ecomi_sound_sawtooth` | Unlocks Buzzy (sawtooth) sound pack       |
| `sound_mellow` | `ecomi_sound_triangle` | Unlocks Mellow (triangle wave) sound pack |

## Localization

English is required for App Store review. Spanish and Portuguese can be added post-launch.

### Spanish (ES)

| Product ID             | Display Name      | Description                                          |
| ---------------------- | ----------------- | ---------------------------------------------------- |
| `ecomi_remove_ads`     | Eliminar anuncios | Elimina todos los anuncios de Eco Mi permanentemente |
| `ecomi_theme_neon`     | Tema Neon         | Desbloquea el tema de color Neon para tu tablero     |
| `ecomi_theme_retro`    | Tema Retro        | Desbloquea el tema de color Retro para tu tablero    |
| `ecomi_theme_pastel`   | Tema Pastel       | Desbloquea el tema de color Pastel para tu tablero   |
| `ecomi_sound_square`   | Sonido Retro      | Desbloquea el paquete de sonido retro chiptune       |
| `ecomi_sound_sawtooth` | Sonido Buzzy      | Desbloquea el paquete de sonido sawtooth             |
| `ecomi_sound_triangle` | Sonido Mellow     | Desbloquea el paquete de sonido triangle suave       |

### Portuguese (PT)

| Product ID             | Display Name     | Description                                         |
| ---------------------- | ---------------- | --------------------------------------------------- |
| `ecomi_remove_ads`     | Remover anuncios | Remova todos os anuncios do Eco Mi permanentemente  |
| `ecomi_theme_neon`     | Tema Neon        | Desbloqueie o tema de cor Neon para seu tabuleiro   |
| `ecomi_theme_retro`    | Tema Retro       | Desbloqueie o tema de cor Retro para seu tabuleiro  |
| `ecomi_theme_pastel`   | Tema Pastel      | Desbloqueie o tema de cor Pastel para seu tabuleiro |
| `ecomi_sound_square`   | Som Retro        | Desbloqueie o pacote de som retro chiptune          |
| `ecomi_sound_sawtooth` | Som Buzzy        | Desbloqueie o pacote de som sawtooth                |
| `ecomi_sound_triangle` | Som Mellow       | Desbloqueie o pacote de som triangle suave          |

## Notes

- All products are non-consumable (one-time purchase, restorable)
- Apple handles currency conversion per region automatically
- Google Play product IDs must match exactly (configured in Play Console)
- RevenueCat maps products to entitlements — code checks entitlements, not product IDs
- Review screenshot: settings modal showing lock icons and unlock button
