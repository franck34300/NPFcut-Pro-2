// Centralized font URLs for text-to-path conversion (opentype.js)
// Single source of truth — used by both convertTextToPath and the font picker

export const FONT_URLS = {
  'Roboto':            'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf',
  'Open Sans':         'https://fonts.gstatic.com/s/opensans/v34/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.ttf',
  'Lato':              'https://fonts.gstatic.com/s/lato/v23/S6uyw4BMUTPHjx4wWw.ttf',
  'Montserrat':        'https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm459WlhyyTh89Y.ttf',
  'Poppins':           'https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrFJA.ttf',
  'Oswald':            'https://fonts.gstatic.com/s/oswald/v49/TK3_WkUHHAIjg75cFRf3bXL8LICs1_FvsUtiZTaR.ttf',
  'Raleway':           'https://fonts.gstatic.com/s/raleway/v28/1Ptxg8zYS_SKggPN4iEgvnHyvveLxVvaorCIPrE.ttf',
  'Nunito':            'https://fonts.gstatic.com/s/nunito/v25/XRXI3I6Li01BKofiOc5wtlZ2di8HDLshdTQ3j77e.ttf',
  'Nunito Sans':       'https://fonts.gstatic.com/s/nunitosans/v12/pe0qMImSLYBIv1o4X1M8cce9I9tAcVwo.ttf',
  'Ubuntu':            'https://fonts.gstatic.com/s/ubuntu/v20/4iCs6KVjbNBYlgo6eA.ttf',
  'Work Sans':         'https://fonts.gstatic.com/s/worksans/v18/QGY_z_wNahGAdqQ43RhVcIgYT2Xz5u32K0nWNigDp6_cOyA.ttf',
  'Noto Sans':         'https://fonts.gstatic.com/s/notosans/v28/o-0IIpQlx3QUlC5A4PNr5TRA.ttf',
  'Source Sans Pro':   'https://fonts.gstatic.com/s/sourcesanspro/v21/6xK3dSBYKcSV-LCoeQqfX1RYOo3qOK7lujVj9w.ttf',
  'PT Sans':           'https://fonts.gstatic.com/s/ptsans/v17/jizaRExUiTo99u79D0KExQ.ttf',
  'Mulish':            'https://fonts.gstatic.com/s/mulish/v12/1Ptyg83HX_SGhgqk3wo.ttf',
  'Quicksand':         'https://fonts.gstatic.com/s/quicksand/v30/6xKtdSZaM9iE8KbpRA_hK1QN.ttf',
  'Karla':             'https://fonts.gstatic.com/s/karla/v23/qkBIXvYC6trAT55ZBi1ueQVIjQTDeJqqFENLR7fHGw.ttf',
  'Inter':             'https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.ttf',
  'Barlow':            'https://fonts.gstatic.com/s/barlow/v12/7cHpv4kjgoGqM7E3b8s.ttf',
  'Josefin Sans':      'https://fonts.gstatic.com/s/josefinsans/v25/Qw3PZQNVED7rKGKxtqIqX5E-AVSJrOCfjY46_DjQbMlhLzTs.ttf',
  'Exo 2':             'https://fonts.gstatic.com/s/exo2/v20/7cH1v4okm5zmbvwkAx_sfcEuiD8jvvOcPtq-rpvLpQ.ttf',
  'Cabin':             'https://fonts.gstatic.com/s/cabin/v26/u-4X0qWljRw-PfU81xCKCpdpbgZJl6XFpfEd7eA9BIxxkV2EL7Gvxm7rE_s.ttf',
  'DM Sans':           'https://fonts.gstatic.com/s/dmsans/v11/rP2Hp2ywxg089UriOZSCHBeHFl0.ttf',
  'Manrope':           'https://fonts.gstatic.com/s/manrope/v13/xn7gYHE41ni1AdIRggqxSuXd.ttf',
  'Outfit':            'https://fonts.gstatic.com/s/outfit/v6/QGYyz_MVcBeNP4NjuGObqx1XmO1I4W61O4a0Ew.ttf',
  'Merriweather':      'https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5OeyxNV-bnrw.ttf',
  'Playfair Display':  'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf',
  'Lora':              'https://fonts.gstatic.com/s/lora/v32/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkq0.ttf',
  'PT Serif':          'https://fonts.gstatic.com/s/ptserif/v17/EJRVQgYoZZY2vCFuvAFWzr8.ttf',
  'EB Garamond':       'https://fonts.gstatic.com/s/ebgaramond/v26/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RUA4V-e6yHgQ.ttf',
  'Libre Baskerville': 'https://fonts.gstatic.com/s/librebaskerville/v14/kmKnZrc3Hgbbcjq75U4uslyuy4kn0qNZaxMaC82U.ttf',
  'Cormorant Garamond':'https://fonts.gstatic.com/s/cormorantgaramond/v16/co3bmX5slCNuHLi8bLeY9MK7whWMhyjQAllvuQWJ5heb_w.ttf',
  'Crimson Text':      'https://fonts.gstatic.com/s/crimsontext/v19/wlp2gwHKFkZgtmSR3NB0oRJfbwhT.ttf',
  'Spectral':          'https://fonts.gstatic.com/s/spectral/v13/rnCs-xNNww_2s0amA9M8qrXHafOPXHIo.ttf',
  'Zilla Slab':        'https://fonts.gstatic.com/s/zillaslab/v11/dFa6ZfeM_74wlPZtksIFaj8CVHapXnp2fazkfg.ttf',
  'Bebas Neue':        'https://fonts.gstatic.com/s/bebasneue/v9/JTUSjIg69CK48gW7PXoo9Wlhyw.ttf',
  'Anton':             'https://fonts.gstatic.com/s/anton/v23/1Ptgg87LROyAm0K08i4gS7lu.ttf',
  'Russo One':         'https://fonts.gstatic.com/s/russoone/v14/Z9XUDmZRWg6M1LvRYsH-yMOInrib9Q.ttf',
  'Black Han Sans':    'https://fonts.gstatic.com/s/blackhansans/v17/ea8Aad44WunzF9a-dL6toA8r8nqVIXSkH-Hc.ttf',
  'Righteous':         'https://fonts.gstatic.com/s/righteous/v13/1cXxaUPXBpj2rGoU7C9mj3uEicG01A.ttf',
  'Teko':              'https://fonts.gstatic.com/s/teko/v15/LYjCdG7kmE0gdQhfgCNqqVIuTN4.ttf',
  'Barlow Condensed':  'https://fonts.gstatic.com/s/barlowcondensed/v12/HTx3L3I-JCGChYJ8VI-L6OO_au7B4-LUoKYHpkmw.ttf',
  'Fjalla One':        'https://fonts.gstatic.com/s/fjallaone/v13/Yq6R-LCAWCX3-6Ky7FAFnOZwkxgtUb8.ttf',
  'Arvo':              'https://fonts.gstatic.com/s/arvo/v20/tDbD2oWUg0MKqScQ7Q.ttf',
  'Alfa Slab One':     'https://fonts.gstatic.com/s/alfaslabone/v17/6NUQ8FmMKwSEKjnm5-4v-4Jh6dVretWvYmE.ttf',
  'Squada One':        'https://fonts.gstatic.com/s/squadaone/v14/BCasqZ8XsOrx4mcOk6MtWaA8lqw.ttf',
  'Big Shoulders Display':'https://fonts.gstatic.com/s/bigshouldersdisplay/v18/fC1MPZJEZG-e9gHhdI4-NBbfd2ys3SjJCx12wPgf9g-_3F0YdY86JF46SRP4yZQ.ttf',
  'Boogaloo':          'https://fonts.gstatic.com/s/boogaloo/v21/kmK-Zq45GAvOdnaW6x1F_SrQo_1K.ttf',
  'Fredoka One':       'https://fonts.gstatic.com/s/fredokaone/v13/k3kUo8kEI-tA1RRcTZGmTmHBA6aF8Bf_.ttf',
  'Dancing Script':    'https://fonts.gstatic.com/s/dancingscript/v24/If2cXTr6YS-zF4S-kcSWSVi_sxjsohD9F50Ruu7BMSoHTeB9ptDqpw.ttf',
  'Pacifico':          'https://fonts.gstatic.com/s/pacifico/v22/FwZY7-Qmy14u9lezJ-6H6MmBp0u-.ttf',
  'Caveat':            'https://fonts.gstatic.com/s/caveat/v17/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SIKjYBxPigs.ttf',
  'Permanent Marker':  'https://fonts.gstatic.com/s/permanentmarker/v16/Fh4uPib9Iyv2ucM6pGQMWimMp004HaqIfrT5nlk.ttf',
  'Satisfy':           'https://fonts.gstatic.com/s/satisfy/v17/rP2Hp2ywxg089UriCZOIHQ.ttf',
  'Great Vibes':       'https://fonts.gstatic.com/s/greatvibes/v14/RWmMoKWR9v4ksMfaWd_JN9XLiaQ4DA.ttf',
  'Lobster':           'https://fonts.gstatic.com/s/lobster/v28/neILzCirqoswsqX9_oWsMqEzSJQ.ttf',
  'Sacramento':        'https://fonts.gstatic.com/s/sacramento/v13/buEzpo6gcdjy0EiZMBUG0CoV_NxLeiw.ttf',
  'Kaushan Script':    'https://fonts.gstatic.com/s/kaushanscript/v14/vm8vdRfvXFLG3OLnsO15WYS5DF7_ytN3M48a.ttf',
  'Parisienne':        'https://fonts.gstatic.com/s/parisienne/v13/E21i_d3kivvAkxhLEVZpcy96DuKuAvM.ttf',
  'Courgette':         'https://fonts.gstatic.com/s/courgette/v13/wEO_EBrAnc9BLjLQAUkFUfAL3EsHiA.ttf',
  'Allura':            'https://fonts.gstatic.com/s/allura/v19/9oRPNYsQpS4zjuAPjAIXPtrrGA.ttf',
  'Alex Brush':        'https://fonts.gstatic.com/s/alexbrush/v20/SZc83FzrJKuqFbwMKk6EhUXz6w.ttf',
  'Tangerine':         'https://fonts.gstatic.com/s/tangerine/v17/IurY6Y5j_oScZZow4VOxCZZM.ttf',
  'Italianno':         'https://fonts.gstatic.com/s/italianno/v16/dg4n_p3sv6gCJkwzT6Rnj5YpQwM.ttf',
  'Pinyon Script':     'https://fonts.gstatic.com/s/pinyonscript/v19/6xKpdSJbL9-e9LuoeQiDRQR8aOLQO4bhiDY.ttf',
  'Roboto Mono':       'https://fonts.gstatic.com/s/robotomono/v22/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vuPQ--5Ip2sSQ.ttf',
  'JetBrains Mono':    'https://fonts.gstatic.com/s/jetbrainsmono/v13/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKxjPVmUsaaDhw.ttf',
  'Source Code Pro':   'https://fonts.gstatic.com/s/sourcecodepro/v22/HI_diYsKILxRpg3hIP6sJ7fM7PqPMcMnZFqUwX28DMyQtMlrQA.ttf',
  'Fira Code':         'https://fonts.gstatic.com/s/firacode/v21/uU9eCBsR6Z2vfE9aq3bL0fxyUs4tcw4W_D1sFVc.ttf',
  'Space Mono':        'https://fonts.gstatic.com/s/spacemono/v12/i7dPIFZifjKcF5UAWdDRUEZ2RFq7AwU.ttf',
  'Arial':             'https://fonts.gstatic.com/s/roboto/v30/KFOmCnqEu92Fr1Me5WZLCzYlKw.ttf',
  'Courier New':       'https://fonts.gstatic.com/s/robotomono/v22/L0xuDF4xlVMF-BfR8bXMIhJHg45mwgGEFl0_3vuPQ--5Ip2sSQ.ttf',
  'Times New Roman':   'https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5OeyxNV-bnrw.ttf',
  'Georgia':           'https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTnCjmHKM4nYO7KN_qiTbtY.ttf',
};

export const DEFAULT_FONT_URL = FONT_URLS['Roboto'];

// Font groups for the font picker select
export const FONT_GROUPS = [
  {
    label: '── Sans-serif ──',
    fonts: ['Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins', 'Oswald', 'Raleway', 'Nunito', 'Nunito Sans', 'Ubuntu', 'Work Sans', 'Noto Sans', 'Source Sans Pro', 'PT Sans', 'Mulish', 'Quicksand', 'Karla', 'Inter', 'Barlow', 'Josefin Sans', 'Exo 2', 'Cabin', 'DM Sans', 'Manrope', 'Outfit']
  },
  {
    label: '── Serif ──',
    fonts: ['Merriweather', 'Playfair Display', 'Lora', 'PT Serif', 'EB Garamond', 'Libre Baskerville', 'Cormorant Garamond', 'Crimson Text', 'Spectral', 'Zilla Slab', 'Times New Roman', 'Georgia']
  },
  {
    label: '── Gros titres / Display ──',
    fonts: ['Bebas Neue', 'Anton', 'Russo One', 'Black Han Sans', 'Righteous', 'Teko', 'Barlow Condensed', 'Fjalla One', 'Arvo', 'Alfa Slab One', 'Squada One', 'Big Shoulders Display', 'Boogaloo', 'Fredoka One']
  },
  {
    label: '── Manuscrites / Calligraphie ──',
    fonts: ['Dancing Script', 'Pacifico', 'Caveat', 'Permanent Marker', 'Satisfy', 'Great Vibes', 'Lobster', 'Sacramento', 'Kaushan Script', 'Parisienne', 'Courgette', 'Allura', 'Alex Brush', 'Tangerine', 'Italianno', 'Pinyon Script']
  },
  {
    label: '── Monospace / Code ──',
    fonts: ['Roboto Mono', 'JetBrains Mono', 'Source Code Pro', 'Fira Code', 'Space Mono', 'Courier New', 'Arial']
  },
];