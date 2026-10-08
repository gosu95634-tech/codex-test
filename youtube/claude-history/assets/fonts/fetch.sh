#!/usr/bin/env bash
# Downloads the OFL fonts used by the film renderer (not committed: ~29 MB).
set -euo pipefail
cd "$(dirname "$0")"
dl() { [ -f "$1" ] || curl -sSf -o "$1" "$2"; }
dl BlackHanSans.ttf       https://fonts.gstatic.com/s/blackhansans/v24/ea8Aad44WunzF9a-dL6toA8r8nqV.ttf
dl DelaGothicOne.ttf      https://fonts.gstatic.com/s/delagothicone/v19/hESp6XxvMDRA-2eD0lXpDa6QkBAGRQ.ttf
dl JetBrainsMono-Bold.ttf https://fonts.gstatic.com/s/jetbrainsmono/v24/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8L6tjPQ.ttf
dl NotoSansKR-Medium.ttf  https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzztgyeLQ.ttf
dl NotoSansKR-Black.ttf   https://fonts.gstatic.com/s/notosanskr/v40/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzkM1eLQ.ttf
dl NotoSerifKR-Black.ttf  https://fonts.gstatic.com/s/notoserifkr/v32/3JnoSDn90Gmq2mr3blnHaTZXbOtLJDvui3JOnchPf852.ttf
echo "fonts ready"
