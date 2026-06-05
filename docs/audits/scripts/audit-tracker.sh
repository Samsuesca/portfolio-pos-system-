#!/bin/bash
# audit-tracker.sh — Registra y consulta evaluaciones de auditoria
# Uso: ./docs/audits/scripts/audit-tracker.sh [add|status|report|dashboard]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUDITS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CSV_FILE="$AUDITS_DIR/scores.csv"
HISTORY_DIR="$AUDITS_DIR/history"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

mkdir -p "$HISTORY_DIR"

if [[ ! -f "$CSV_FILE" ]]; then
    echo -e "${RED}Error: scores.csv not found at $CSV_FILE${NC}"
    exit 1
fi

# Get list of unique areas from CSV (excluding header)
get_areas() {
    tail -n +2 "$CSV_FILE" | awk -F',' '{print $1}' | sort -u
}

# Get categories for an area (excluding GLOBAL)
get_categories() {
    local area="$1"
    tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2!="GLOBAL" {print $2}'
}

# Find the next empty iteration column for an area
find_next_iter() {
    local area="$1"
    local global_line
    global_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL"')

    for i in $(seq 1 10); do
        local score_col=$((2 + (i - 1) * 2 + 1))
        local val
        val=$(echo "$global_line" | awk -F',' -v c="$score_col" '{print $c}')
        if [[ -z "$val" ]]; then
            echo "$i"
            return
        fi
    done
    echo "0"
}

# Get the latest score for an area's GLOBAL row
get_latest_global() {
    local area="$1"
    local global_line
    global_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL"')

    for i in $(seq 10 -1 1); do
        local score_col=$((2 + (i - 1) * 2 + 1))
        local val
        val=$(echo "$global_line" | awk -F',' -v c="$score_col" '{print $c}')
        if [[ -n "$val" ]]; then
            echo "$val"
            return
        fi
    done
    echo ""
}

# Get the latest score for a specific category
get_latest_category() {
    local area="$1"
    local cat="$2"
    local line
    line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" -v c="$cat" '$1==a && $2==c')

    for i in $(seq 10 -1 1); do
        local score_col=$((2 + (i - 1) * 2 + 1))
        local val
        val=$(echo "$line" | awk -F',' -v c="$score_col" '{print $c}')
        if [[ -n "$val" ]]; then
            echo "$val"
            return
        fi
    done
    echo ""
}

# Get target for an area's GLOBAL row
get_target() {
    local area="$1"
    tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL" {print $23}'
}

# Get status for an area's GLOBAL row
get_status() {
    local area="$1"
    tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL" {print $24}'
}

# Color a status string
color_status() {
    local status="$1"
    case "$status" in
        achieved)  echo -e "${GREEN}${status}${NC}" ;;
        in-progress) echo -e "${YELLOW}${status}${NC}" ;;
        pending)   echo -e "${DIM}${status}${NC}" ;;
        regressed) echo -e "${RED}${status}${NC}" ;;
        *)         echo "$status" ;;
    esac
}

# Color a score based on distance to target
color_score() {
    local score="$1"
    local target="$2"
    if [[ -z "$score" ]]; then
        echo -e "${DIM}--${NC}"
        return
    fi
    local cmp
    cmp=$(awk "BEGIN {print ($score >= $target) ? 1 : ($score >= $target - 1) ? 0 : -1}")
    case "$cmp" in
        1)  echo -e "${GREEN}${score}${NC}" ;;
        0)  echo -e "${YELLOW}${score}${NC}" ;;
        -1) echo -e "${RED}${score}${NC}" ;;
    esac
}

# Update a cell in the CSV
update_csv_cell() {
    local area="$1"
    local category="$2"
    local iter_num="$3"
    local score="$4"
    local date_val="$5"

    local score_col=$((2 + (iter_num - 1) * 2 + 1))
    local date_col=$((score_col + 1))

    local tmp_file
    tmp_file="${TMPDIR:-/tmp}/audit-tracker-$$.csv"

    awk -F',' -v a="$area" -v c="$category" -v sc="$score_col" -v dc="$date_col" -v s="$score" -v d="$date_val" '
    BEGIN {OFS=","}
    NR==1 {print; next}
    $1==a && $2==c {
        for (i=1; i<=24; i++) {
            if (i == sc) $i = s
            else if (i == dc) $i = d
        }
        print
        next
    }
    {print}
    ' "$CSV_FILE" > "$tmp_file"

    mv "$tmp_file" "$CSV_FILE"
}

# Update status for a row
update_status() {
    local area="$1"
    local category="$2"
    local new_status="$3"

    local tmp_file
    tmp_file="${TMPDIR:-/tmp}/audit-tracker-$$.csv"

    awk -F',' -v a="$area" -v c="$category" -v s="$new_status" '
    BEGIN {OFS=","}
    NR==1 {print; next}
    $1==a && $2==c {
        $24 = s
        print
        next
    }
    {print}
    ' "$CSV_FILE" > "$tmp_file"

    mv "$tmp_file" "$CSV_FILE"
}

# ── CMD: add ──────────────────────────────────────────────
cmd_add() {
    echo -e "${BOLD}${CYAN}=== Registrar Nueva Evaluacion ===${NC}\n"

    echo -e "${BOLD}Areas disponibles:${NC}"
    local areas
    areas=$(get_areas)
    local i=1
    declare -a area_list=()
    while IFS= read -r area; do
        local latest
        latest=$(get_latest_global "$area")
        local status
        status=$(get_status "$area")
        local status_colored
        status_colored=$(color_status "$status")
        if [[ -n "$latest" ]]; then
            printf "  ${BOLD}%2d)${NC} %-25s [ultima: %s] %b\n" "$i" "$area" "$latest" "$status_colored"
        else
            printf "  ${BOLD}%2d)${NC} %-25s %b\n" "$i" "$area" "$status_colored"
        fi
        area_list+=("$area")
        i=$((i + 1))
    done <<< "$areas"

    echo ""
    read -rp "Selecciona area (numero o nombre): " area_input

    local selected_area=""
    if [[ "$area_input" =~ ^[0-9]+$ ]] && (( area_input >= 1 && area_input <= ${#area_list[@]} )); then
        selected_area="${area_list[$((area_input - 1))]}"
    else
        for a in "${area_list[@]}"; do
            if [[ "$a" == "$area_input" ]]; then
                selected_area="$a"
                break
            fi
        done
    fi

    if [[ -z "$selected_area" ]]; then
        echo -e "${RED}Area no encontrada: $area_input${NC}"
        exit 1
    fi

    local next_iter
    next_iter=$(find_next_iter "$selected_area")
    if [[ "$next_iter" == "0" ]]; then
        echo -e "${RED}Error: area '$selected_area' ya tiene 10 iteraciones (maximo).${NC}"
        exit 1
    fi

    echo -e "\n${BOLD}Area: ${CYAN}$selected_area${NC} | Iteracion: ${BOLD}v${next_iter}${NC}"

    local today
    today=$(date +%Y-%m-%d)
    read -rp "Fecha [$today]: " eval_date
    eval_date="${eval_date:-$today}"

    echo -e "\n${BOLD}Notas por categoria (1.0 - 10.0):${NC}"
    local categories
    categories=$(get_categories "$selected_area")

    declare -A scores=()
    while IFS= read -r cat; do
        local prev
        prev=$(get_latest_category "$selected_area" "$cat")
        local prompt_extra=""
        if [[ -n "$prev" ]]; then
            prompt_extra=" (anterior: $prev)"
        fi
        read -rp "  $cat${prompt_extra}: " score
        if [[ -z "$score" ]]; then
            echo -e "${YELLOW}    Saltando $cat${NC}"
            continue
        fi
        if ! awk "BEGIN {exit ($score >= 0 && $score <= 10) ? 0 : 1}" 2>/dev/null; then
            echo -e "${RED}    Nota invalida, saltando${NC}"
            continue
        fi
        scores["$cat"]="$score"
    done <<< "$categories"

    read -rp "  GLOBAL (/100): " global_score
    if [[ -z "$global_score" ]]; then
        echo -e "${RED}Nota global requerida.${NC}"
        exit 1
    fi

    echo -e "\n${BOLD}Resumen:${NC}"
    echo -e "  Area:      $selected_area"
    echo -e "  Iteracion: v$next_iter"
    echo -e "  Fecha:     $eval_date"
    echo -e "  Global:    $global_score"
    for cat in "${!scores[@]}"; do
        echo -e "  $cat: ${scores[$cat]}"
    done

    read -rp "Confirmar? [Y/n]: " confirm
    confirm="${confirm:-Y}"
    if [[ "$confirm" != "Y" && "$confirm" != "y" ]]; then
        echo "Cancelado."
        exit 0
    fi

    for cat in "${!scores[@]}"; do
        update_csv_cell "$selected_area" "$cat" "$next_iter" "${scores[$cat]}" "$eval_date"

        local target_line
        target_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$selected_area" -v c="$cat" '$1==a && $2==c {print $23}')
        local new_status="in-progress"
        if awk "BEGIN {exit (${scores[$cat]} >= $target_line) ? 0 : 1}" 2>/dev/null; then
            new_status="achieved"
        fi
        update_status "$selected_area" "$cat" "$new_status"
    done

    update_csv_cell "$selected_area" "GLOBAL" "$next_iter" "$global_score" "$eval_date"
    local global_target
    global_target=$(get_target "$selected_area")
    local global_status="in-progress"
    if awk "BEGIN {exit ($global_score >= $global_target) ? 0 : 1}" 2>/dev/null; then
        global_status="achieved"
    fi
    update_status "$selected_area" "GLOBAL" "$global_status"

    echo -e "\n${GREEN}Scores actualizados en scores.csv${NC}"

    read -rp "Ruta al reporte completo (Enter para saltar): " report_path
    if [[ -n "$report_path" && -f "$report_path" ]]; then
        local dest="$HISTORY_DIR/${selected_area}_${eval_date}_v${next_iter}.md"
        cp "$report_path" "$dest"
        echo -e "${GREEN}Reporte copiado a: $dest${NC}"
    fi

    echo -e "\n${GREEN}${BOLD}Evaluacion v${next_iter} registrada para $selected_area.${NC}"
}

# ── CMD: status ───────────────────────────────────────────
cmd_status() {
    echo -e "${BOLD}${CYAN}=== Estado de Auditorias ===${NC}\n"

    printf "${BOLD}%-25s %8s %8s %8s  %-12s${NC}\n" "Area" "Ultima" "Target" "Delta" "Status"
    printf "%-25s %8s %8s %8s  %-12s\n" "-------------------------" "--------" "--------" "--------" "------------"

    local achieved=0 in_progress=0 pending=0 total=0

    local areas
    areas=$(get_areas)
    while IFS= read -r area; do
        local latest
        latest=$(get_latest_global "$area")
        local target
        target=$(get_target "$area")
        local status
        status=$(get_status "$area")

        local delta=""
        local score_display
        local delta_display

        if [[ -n "$latest" ]]; then
            score_display=$(color_score "$latest" "$target")
            delta=$(awk "BEGIN {printf \"%.1f\", $latest - $target}")
            if awk "BEGIN {exit ($latest >= $target) ? 0 : 1}"; then
                delta_display="${GREEN}+${delta}${NC}"
            else
                delta_display="${RED}${delta}${NC}"
            fi
        else
            score_display=$(echo -e "${DIM}--${NC}")
            delta_display=$(echo -e "${DIM}--${NC}")
        fi

        local status_colored
        status_colored=$(color_status "$status")

        printf "%-25s %b %8s %b  %b\n" "$area" "$score_display" "$target" "$delta_display" "$status_colored"

        total=$((total + 1))
        case "$status" in
            achieved)    achieved=$((achieved + 1)) ;;
            in-progress) in_progress=$((in_progress + 1)) ;;
            pending)     pending=$((pending + 1)) ;;
        esac
    done <<< "$areas"

    echo ""
    echo -e "${BOLD}Resumen:${NC}"
    local pct=0
    if (( total > 0 )); then
        pct=$((achieved * 100 / total))
    fi
    echo -e "  ${GREEN}Achieved:${NC}    $achieved"
    echo -e "  ${YELLOW}In Progress:${NC} $in_progress"
    echo -e "  ${DIM}Pending:${NC}     $pending"
    echo -e "  ${BOLD}Progreso:${NC}    ${pct}% de areas en target ($achieved/$total)"
}

# ── CMD: report ───────────────────────────────────────────
cmd_report() {
    local area="$1"
    if [[ -z "$area" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh report <area>${NC}"
        echo -e "Areas: $(get_areas | tr '\n' ' ')"
        exit 1
    fi

    local line_count
    line_count=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a' | wc -l)
    if (( line_count == 0 )); then
        echo -e "${RED}Area '$area' no encontrada.${NC}"
        exit 1
    fi

    echo -e "${BOLD}${CYAN}=== Historial: $area ===${NC}\n"

    echo -e "${BOLD}Iteraciones GLOBAL:${NC}"
    local global_line
    global_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL"')
    local target
    target=$(echo "$global_line" | awk -F',' '{print $23}')

    local prev_score=""
    for i in $(seq 1 10); do
        local score_col=$((2 + (i - 1) * 2 + 1))
        local date_col=$((score_col + 1))
        local score
        score=$(echo "$global_line" | awk -F',' -v c="$score_col" '{print $c}')
        local date_val
        date_val=$(echo "$global_line" | awk -F',' -v c="$date_col" '{print $c}')

        if [[ -z "$score" ]]; then
            break
        fi

        local delta_str=""
        if [[ -n "$prev_score" ]]; then
            local delta
            delta=$(awk "BEGIN {printf \"%.1f\", $score - $prev_score}")
            if awk "BEGIN {exit ($score >= $prev_score) ? 0 : 1}"; then
                delta_str="${GREEN}(+${delta})${NC}"
            else
                delta_str="${RED}(${delta})${NC}"
            fi
        fi

        local score_colored
        score_colored=$(color_score "$score" "$target")
        printf "  v%-2d  %s  %b  %b\n" "$i" "$date_val" "$score_colored" "$delta_str"
        prev_score="$score"
    done

    echo -e "\n${BOLD}Detalle por categoria (ultima iteracion):${NC}"
    printf "  ${BOLD}%-25s %8s %8s %8s${NC}\n" "Categoria" "Score" "Target" "Status"

    local categories
    categories=$(get_categories "$area")
    local best_cat="" best_delta=-999
    local worst_cat="" worst_delta=999

    while IFS= read -r cat; do
        local cat_line
        cat_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" -v c="$cat" '$1==a && $2==c')
        local cat_target
        cat_target=$(echo "$cat_line" | awk -F',' '{print $23}')
        local cat_status
        cat_status=$(echo "$cat_line" | awk -F',' '{print $24}')
        local latest
        latest=$(get_latest_category "$area" "$cat")

        local score_colored
        score_colored=$(color_score "$latest" "$cat_target")
        local status_colored
        status_colored=$(color_status "$cat_status")

        printf "  %-25s %b %8s  %b\n" "$cat" "$score_colored" "$cat_target" "$status_colored"

        if [[ -n "$latest" ]]; then
            local d
            d=$(awk "BEGIN {printf \"%.1f\", $latest - $cat_target}")
            if awk "BEGIN {exit ($d > $best_delta) ? 0 : 1}" 2>/dev/null; then
                best_delta="$d"
                best_cat="$cat"
            fi
            if awk "BEGIN {exit ($d < $worst_delta) ? 0 : 1}" 2>/dev/null; then
                worst_delta="$d"
                worst_cat="$cat"
            fi
        fi
    done <<< "$categories"

    if [[ -n "$best_cat" ]]; then
        echo -e "\n  ${GREEN}Mejor:${NC}  $best_cat (delta: $best_delta)"
        echo -e "  ${RED}Peor:${NC}   $worst_cat (delta: $worst_delta)"
    fi

    echo -e "\n${BOLD}Reportes:${NC}"
    local found=0
    for f in "$HISTORY_DIR/${area}_"*.md; do
        if [[ -f "$f" ]]; then
            echo "  $(basename "$f")"
            found=1
        fi
    done
    if (( found == 0 )); then
        echo -e "  ${DIM}(ninguno)${NC}"
    fi
}

# ── CMD: dashboard ────────────────────────────────────────
cmd_dashboard() {
    echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║     AUDIT DASHBOARD — Executive View    ║${NC}"
    echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}\n"

    local total_score=0 total_target=0 scored_count=0 total_areas=0

    local areas
    areas=$(get_areas)

    declare -a strong_areas=()
    declare -a weak_areas=()
    declare -a pending_areas=()

    while IFS= read -r area; do
        local latest
        latest=$(get_latest_global "$area")
        local target
        target=$(get_target "$area")
        local status
        status=$(get_status "$area")
        total_areas=$((total_areas + 1))

        if [[ -n "$latest" ]]; then
            total_score=$(awk "BEGIN {printf \"%.1f\", $total_score + $latest}")
            total_target=$(awk "BEGIN {printf \"%.1f\", $total_target + $target}")
            scored_count=$((scored_count + 1))

            local delta
            delta=$(awk "BEGIN {printf \"%.1f\", $latest - $target}")
            if awk "BEGIN {exit ($latest >= $target) ? 0 : 1}"; then
                strong_areas+=("$area ($latest/$target)")
            else
                weak_areas+=("$area ($latest/$target, delta: $delta)")
            fi
        else
            pending_areas+=("$area (target: $target)")
        fi
    done <<< "$areas"

    if (( scored_count > 0 )); then
        local avg_score
        avg_score=$(awk "BEGIN {printf \"%.1f\", $total_score / $scored_count}")
        local avg_target
        avg_target=$(awk "BEGIN {printf \"%.1f\", $total_target / $scored_count}")
        echo -e "${BOLD}Promedio Global:${NC}  ${CYAN}${avg_score}${NC} / ${avg_target} (target)"
    fi
    echo -e "${BOLD}Areas evaluadas:${NC} $scored_count / $total_areas"
    echo ""

    if (( ${#strong_areas[@]} > 0 )); then
        echo -e "${GREEN}${BOLD}Areas en target:${NC}"
        for s in "${strong_areas[@]}"; do
            echo -e "  ${GREEN}+${NC} $s"
        done
        echo ""
    fi

    if (( ${#weak_areas[@]} > 0 )); then
        echo -e "${RED}${BOLD}Areas bajo target:${NC}"
        for w in "${weak_areas[@]}"; do
            echo -e "  ${RED}-${NC} $w"
        done
        echo ""
    fi

    if (( ${#pending_areas[@]} > 0 )); then
        echo -e "${BOLD}Proximas areas sugeridas (por prioridad):${NC}"
        local count=0
        for p in "${pending_areas[@]}"; do
            echo -e "  ${DIM}○${NC} $p"
            count=$((count + 1))
            if (( count >= 5 )); then
                local remaining=$(( ${#pending_areas[@]} - 5 ))
                if (( remaining > 0 )); then
                    echo -e "  ${DIM}... y $remaining mas${NC}"
                fi
                break
            fi
        done
    fi
}

# ── CMD: set (non-interactive) ────────────────────────────
cmd_set() {
    local area="$1"
    local category="$2"
    local score="$3"
    local date_val="${4:-$(date +%Y-%m-%d)}"

    if [[ -z "$area" || -z "$category" || -z "$score" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh set <area> <category> <score> [date]${NC}"
        echo -e "  Ejemplo: audit-tracker.sh set api-rest uri-design 7.5 2026-04-12"
        echo -e "  Para GLOBAL: audit-tracker.sh set api-rest GLOBAL 78.0"
        exit 1
    fi

    local line_count
    line_count=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" -v c="$category" '$1==a && $2==c' | wc -l | tr -d ' ')
    if (( line_count == 0 )); then
        echo -e "${RED}Error: area='$area' category='$category' no encontrada en scores.csv${NC}"
        exit 1
    fi

    local next_iter
    next_iter=$(find_next_iter "$area")
    if [[ "$next_iter" == "0" ]]; then
        echo -e "${RED}Error: area '$area' ya tiene 10 iteraciones.${NC}"
        exit 1
    fi

    local prev_score
    if [[ "$category" == "GLOBAL" ]]; then
        prev_score=$(get_latest_global "$area")
    else
        prev_score=$(get_latest_category "$area" "$category")
    fi

    # Check if this iter already has data for this area (use same iter)
    local global_line
    global_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL"')
    local existing_score_col=$((2 + (next_iter - 1) * 2 + 1))
    local existing_val
    existing_val=$(echo "$global_line" | awk -F',' -v c="$existing_score_col" '{print $c}')

    # If GLOBAL already has a score for this iter, we're updating categories in the same iter
    # If not, this is a fresh iter — but only advance iter if we're setting GLOBAL
    local target_iter="$next_iter"
    if [[ -n "$existing_val" ]]; then
        # Current iter already has data, update in place
        target_iter=$((next_iter - 1))
        if (( target_iter < 1 )); then target_iter=1; fi
        # Verify this iter has data
        local check_col=$((2 + (target_iter - 1) * 2 + 1))
        local check_val
        check_val=$(echo "$global_line" | awk -F',' -v c="$check_col" '{print $c}')
        if [[ -n "$check_val" ]]; then
            target_iter=$((target_iter))
        fi
    fi

    update_csv_cell "$area" "$category" "$target_iter" "$score" "$date_val"

    local cat_target
    cat_target=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" -v c="$category" '$1==a && $2==c {print $23}')
    local new_status="in-progress"
    if awk "BEGIN {exit ($score >= $cat_target) ? 0 : 1}" 2>/dev/null; then
        new_status="achieved"
    fi
    if [[ -n "$prev_score" ]] && awk "BEGIN {exit ($score < $prev_score) ? 0 : 1}" 2>/dev/null; then
        local prev_status
        prev_status=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" -v c="$category" '$1==a && $2==c {print $24}')
        if [[ "$prev_status" == "achieved" ]]; then
            new_status="regressed"
        fi
    fi
    update_status "$area" "$category" "$new_status"

    local delta=""
    if [[ -n "$prev_score" ]]; then
        delta=$(awk "BEGIN {printf \"%+.1f\", $score - $prev_score}")
    fi

    echo -e "${GREEN}set${NC} $area/$category = $score ($date_val) iter=v$target_iter status=$new_status${delta:+ delta=$delta}"
}

# ── CMD: copy-report ──────────────────────────────────────
cmd_copy_report() {
    local area="$1"
    local source="$2"
    local date_val="${3:-$(date +%Y-%m-%d)}"

    if [[ -z "$area" || -z "$source" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh copy-report <area> <source-file> [date]${NC}"
        exit 1
    fi
    if [[ ! -f "$source" ]]; then
        echo -e "${RED}Error: archivo '$source' no existe.${NC}"
        exit 1
    fi

    # Find the latest iter number for this area
    local latest_iter=0
    local global_line
    global_line=$(tail -n +2 "$CSV_FILE" | awk -F',' -v a="$area" '$1==a && $2=="GLOBAL"')
    for i in $(seq 1 10); do
        local score_col=$((2 + (i - 1) * 2 + 1))
        local val
        val=$(echo "$global_line" | awk -F',' -v c="$score_col" '{print $c}')
        if [[ -n "$val" ]]; then
            latest_iter=$i
        fi
    done

    if (( latest_iter == 0 )); then
        latest_iter=1
    fi

    local dest="$HISTORY_DIR/${area}_${date_val}_v${latest_iter}.md"
    cp "$source" "$dest"
    echo -e "${GREEN}Reporte copiado:${NC} $dest"
}

# ── CMD: next-iter ────────────────────────────────────────
cmd_next_iter() {
    local area="$1"
    if [[ -z "$area" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh next-iter <area>${NC}"
        exit 1
    fi
    find_next_iter "$area"
}

# ── CMD: categories ───────────────────────────────────────
cmd_categories() {
    local area="$1"
    if [[ -z "$area" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh categories <area>${NC}"
        exit 1
    fi
    get_categories "$area"
}

# ── CMD: latest ───────────────────────────────────────────
cmd_latest() {
    local area="$1"
    local category="${2:-GLOBAL}"
    if [[ -z "$area" ]]; then
        echo -e "${RED}Uso: audit-tracker.sh latest <area> [category]${NC}"
        exit 1
    fi
    if [[ "$category" == "GLOBAL" ]]; then
        get_latest_global "$area"
    else
        get_latest_category "$area" "$category"
    fi
}

# ── CMD: areas ────────────────────────────────────────────
cmd_areas() {
    get_areas
}

# ── Main ──────────────────────────────────────────────────
case "${1:-}" in
    add)          cmd_add ;;
    status)       cmd_status ;;
    report)       cmd_report "${2:-}" ;;
    dashboard)    cmd_dashboard ;;
    set)          cmd_set "${2:-}" "${3:-}" "${4:-}" "${5:-}" ;;
    copy-report)  cmd_copy_report "${2:-}" "${3:-}" "${4:-}" ;;
    next-iter)    cmd_next_iter "${2:-}" ;;
    categories)   cmd_categories "${2:-}" ;;
    latest)       cmd_latest "${2:-}" "${3:-}" ;;
    areas)        cmd_areas ;;
    *)
        echo -e "${BOLD}audit-tracker.sh${NC} — Sistema de tracking de auditorias"
        echo ""
        echo "Uso interactivo:"
        echo "  audit-tracker.sh add              Registrar nueva evaluacion"
        echo "  audit-tracker.sh status            Ver estado de todas las areas"
        echo "  audit-tracker.sh report <area>     Ver historial de un area"
        echo "  audit-tracker.sh dashboard         Vista ejecutiva"
        echo ""
        echo "Uso programatico (para skills/scripts):"
        echo "  audit-tracker.sh set <area> <cat> <score> [date]   Escribir un score"
        echo "  audit-tracker.sh copy-report <area> <file> [date]  Copiar reporte a history/"
        echo "  audit-tracker.sh next-iter <area>                  Proximo numero de iteracion"
        echo "  audit-tracker.sh categories <area>                 Listar categorias de un area"
        echo "  audit-tracker.sh latest <area> [cat]               Ultimo score (default: GLOBAL)"
        echo "  audit-tracker.sh areas                             Listar todas las areas"
        ;;
esac
