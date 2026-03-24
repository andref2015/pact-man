(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.PACT_MAN_LOGIC = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function scoreVCTerm(term, value) {
    if (!value) return null;

    switch (term) {
      case 'vc_equity_percentage': {
        const pct = parseFloat(value);
        if (isNaN(pct)) return null;
        if (pct <= 25) return 'no_deal';
        if (pct <= 34) return 2;
        if (pct <= 39) return 3;
        if (pct <= 45) return 6;
        if (pct <= 49) return 9;
        if (pct === 50) return 11;
        if (pct <= 59) return 15;
        if (pct <= 69) return 18;
        return 20;
      }
      case 'type_of_stock': {
        const normalized = value.toLowerCase();
        if (normalized.includes('redeemable')) return 12;
        if (normalized.includes('convertible')) return 8;
        if (normalized.includes('common')) return 0;
        return null;
      }
      case 'vc_board_members': {
        const count = parseInt(value, 10);
        if (isNaN(count)) return null;
        if (count === 0) return 0;
        if (count === 1) return 3;
        if (count === 2) return 5;
        if (count === 3) return 7;
        return 10;
      }
      case 'founder_vesting': {
        const normalized = value.toLowerCase();
        if (normalized === 'none' || normalized === 'no vesting' || normalized === '0') return 'no_deal';
        if (normalized.includes('more than 5') || normalized.includes('over 5') || normalized.includes('6 or more')) return 14;
        if (normalized.includes('less than 4') || normalized.includes('under 4')) return 'no_deal';

        const match = value.match(/\d+/);
        const years = match ? parseFloat(match[0]) : NaN;
        if (isNaN(years)) return null;
        if (years < 4) return 'no_deal';
        if (years === 4) return 8;
        if (years === 5) return 12;
        return 14;
      }
      case 'ceo_replacement': {
        const normalized = value.toLowerCase();
        if (normalized.includes('no provision') || normalized === 'none') return 'no_deal';
        if (normalized.includes('conservative')) return 6;
        if (normalized.includes('moderate')) return 10;
        if (normalized.includes('aggressive')) return 16;
        return null;
      }
      default:
        return null;
    }
  }

  function scoreFounderTerm(term, value) {
    if (!value) return null;

    switch (term) {
      case 'vc_equity_percentage': {
        const pct = parseFloat(value);
        if (isNaN(pct)) return null;
        if (pct >= 60) return 'no_deal';
        if (pct >= 56) return 4;
        if (pct >= 50) return 8;
        if (pct >= 47) return 16;
        if (pct >= 42) return 18;
        if (pct >= 36) return 20;
        if (pct >= 31) return 22;
        return 24;
      }
      case 'type_of_stock': {
        const normalized = value.toLowerCase();
        if (normalized.includes('common')) return 6;
        if (normalized.includes('convertible')) return 5;
        if (normalized.includes('redeemable')) return 2;
        return null;
      }
      case 'vc_board_members': {
        const count = parseInt(value, 10);
        if (isNaN(count)) return null;
        if (count > 2) return 'no_deal';
        if (count === 2) return 6;
        if (count === 1) return 8;
        return 2;
      }
      case 'founder_vesting': {
        const normalized = value.toLowerCase();
        if (normalized === 'none' || normalized === 'no vesting' || normalized === '0') return 12;
        if (normalized.includes('more than 5') || normalized.includes('over 5') || normalized.includes('6 or more')) return 3;
        if (normalized.includes('less than 4') || normalized.includes('under 4')) return 10;

        const match = value.match(/\d+/);
        const years = match ? parseFloat(match[0]) : NaN;
        if (isNaN(years)) return null;
        if (years >= 6) return 3;
        if (years >= 4) return 8;
        return 10;
      }
      case 'ceo_replacement': {
        const normalized = value.toLowerCase();
        if (normalized.includes('aggressive')) return 'no_deal';
        if (normalized.includes('moderate')) return 7;
        if (normalized.includes('conservative')) return 14;
        if (normalized.includes('no provision') || normalized === 'none') return 19;
        return null;
      }
      default:
        return null;
    }
  }

  function positionToMatch(term, value) {
    if (!value) return null;

    switch (term) {
      case 'vc_equity_percentage': {
        const pct = parseFloat(value);
        if (isNaN(pct)) return null;
        if (pct <= 30) return '30_or_less';
        if (pct <= 35) return '31_35';
        if (pct <= 41) return '36_41';
        if (pct <= 46) return '42_46';
        if (pct <= 49) return '47_49';
        if (pct <= 55) return '50_55';
        if (pct <= 59) return '56_59';
        return '60_plus';
      }
      case 'type_of_stock': {
        const normalized = value.toLowerCase();
        if (normalized.includes('redeemable')) return 'redeemable';
        if (normalized.includes('convertible')) return 'convertible';
        if (normalized.includes('common')) return 'common';
        return null;
      }
      case 'vc_board_members': {
        const count = parseInt(value, 10);
        if (isNaN(count)) return null;
        if (count === 0) return '0';
        if (count === 1) return '1';
        if (count === 2) return '2';
        return 'more_than_2';
      }
      case 'founder_vesting': {
        const normalized = value.toLowerCase();
        if (normalized === 'none' || normalized === 'no vesting' || normalized === '0') return 'none';
        if (normalized.includes('6 or more') || normalized.includes('more than 5') || normalized.includes('over 5')) return '6_plus';
        if (normalized.includes('less than 4') || normalized.includes('under 4') || normalized.includes('3 or less')) return '3_or_less';

        const match = value.match(/\d+/);
        const years = match ? parseFloat(match[0]) : NaN;
        if (isNaN(years)) return null;
        if (years >= 6) return '6_plus';
        if (years >= 4) return '4_5';
        if (years <= 3) return '3_or_less';
        return null;
      }
      case 'ceo_replacement': {
        const normalized = value.toLowerCase();
        if (normalized.includes('no provision') || normalized === 'none') return 'none';
        if (normalized.includes('conservative')) return 'conservative';
        if (normalized.includes('moderate')) return 'moderate';
        if (normalized.includes('aggressive')) return 'aggressive';
        return null;
      }
      default:
        return null;
    }
  }

  return {
    positionToMatch,
    scoreFounderTerm,
    scoreVCTerm,
  };
});
