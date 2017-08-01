/**
 * Created by Karthik Kalletla on 4/6/16.
 */
'use strict';
(function(Vue, d3, dc, iViz, _, $, cbio) {
  Vue.component('barChart', {
    template: '<div id={{chartDivId}} ' +
    'class="grid-item grid-item-w-2 grid-item-h-1 bar-chart" ' +
    ':attribute-id="attributes.attr_id" @mouseenter="mouseEnter" ' +
    ':layout-number="attributes.layout" ' +
    '@mouseleave="mouseLeave">' +
    '<chart-operations :show-log-scale="settings.showLogScale"' +
    ':show-operations="showOperations" :groupid="attributes.group_id" ' +
    ':chart-initialed = "!failedToInit"' +
    ':show-survival-icon.sync="showSurvivalIcon"' +
    ':reset-btn-id="resetBtnId" :chart-ctrl="barChart" ' +
    ':chart-id="chartId" :show-log-scale="showLogScale" ' +
    ':attributes="attributes"' +
    ':filters.sync="attributes.filter"></chart-operations>' +
    ' <div id="chart-loader"  :class="{\'show-loading\': showLoad}" ' +
    'class="chart-loader" style="top: 30%; left: 30%; display: none;">' +
    ' <img src="images/ajax-loader.gif" alt="loading"></div>' +
    '<div class="dc-chart dc-bar-chart" align="center" ' +
    'style="float:none !important;" id={{chartId}} >' +
    '<error-handle v-if="failedToInit"></error-handle>' +
    '</div>' +
    '<span class="text-center chart-title-span" ' +
    'id="{{chartId}}-title">{{displayName}}</span>' +
    '</div>',
    props: [
      'ndx', 'attributes', 'showedSurvivalPlot'
    ],
    data: function() {
      return {
        chartDivId:
          iViz.util.getDefaultDomId('chartDivId', this.attributes.attr_id),
        resetBtnId:
          iViz.util.getDefaultDomId('resetBtnId', this.attributes.attr_id),
        chartId:
          iViz.util.getDefaultDomId('chartId', this.attributes.attr_id),
        displayName: this.attributes.display_name,
        chartInst: {},
        barChart: {},
        showOperations: false,
        filtersUpdated: false,
        showSurvivalIcon: false,
        data: {},
        settings: {
          width: 400,
          height: 180,
          showLogScale: false,
          transitionDuration: iViz.opts.dc.transitionDuration
        },
        failedToInit: false,
        opts: {},
        numOfSurvivalCurveLimit: iViz.opts.numOfSurvivalCurveLimit || 20,
        addingChart: false,
        showLoad: true
      };
    }, watch: {
      'attributes.filter': function(newVal) {
        if (this.filtersUpdated) {
          this.filtersUpdated = false;
        } else {
          this.filtersUpdated = true;
          if (newVal.length === 0) {
            this.chartInst.filterAll();
            this.$dispatch('update-filters', true);
          }
        }
        this.barChart.resetBarColor();
      },
      'showedSurvivalPlot': function() {
        this.updateShowSurvivalIcon();
      },
      'attributes.dataLoaded': function() {
        this.processBarchartData();
      }
    }, events: {
      closeChart: function() {
        if (!this.failedToInit) {
          dc.deregisterChart(this.chartInst, this.attributes.group_id);
          this.chartInst.dimension().dispose();
        }
        this.$dispatch('close');
      },
      changeLogScale: function(logScaleChecked) {
        $('#' + this.chartId).find('svg').remove();
        this.chartInst.filterAll();
        this.$dispatch('update-filters', true);
        dc.deregisterChart(this.chartInst, this.attributes.group_id);
        this.initChart(logScaleChecked);
        this.chartInst.render();
      },
      addingChart: function(groupId, val) {
        if (this.attributes.group_id === groupId) {
          if (this.attributes.filter.length > 0) {
            if (val) {
              this.addingChart = val;
              this.chartInst.filter(null);
            } else {
              var filter_ = new dc.filters.RangedFilter(this.attributes.filter[0], this.attributes.filter[1]);
              this.chartInst.filter(filter_);
              this.addingChart = val;
            }
          }
        }
      },
      getRainbowSurvival: function() {
        var groups = [];
        var categories = this.barChart.getCurrentCategories('key');
        _.each(categories, function(category) {
          groups.push({
            name: category.name,
            caseIds: category.caseIds,
            curveHex: category.color
          });
        });
        this.barChart.colorBars(categories);
        this.$dispatch('create-rainbow-survival', {
          attrId: this.attributes.attr_id,
          subtitle: ' (' + this.attributes.display_name + ')',
          groups: groups,
          groupType: this.attributes.group_type
        });
      },
      resetBarColor: function(exceptionAttrIds) {
        if (!this.failedToInit &&
          _.isArray(exceptionAttrIds) && exceptionAttrIds.indexOf(this.attributes.attr_id) === -1) {
          this.barChart.resetBarColor();
        }
      }
    },
    methods: {
      updateShowSurvivalIcon: function() {
        if (this.showedSurvivalPlot) {
          // Disable rainbow survival if only one group present
          if (this.barChart.getCurrentCategories().length < 2 ||
            this.barChart.getCurrentCategories().length > this.numOfSurvivalCurveLimit) {
            this.showSurvivalIcon = false;
          } else {
            this.showSurvivalIcon = true;
          }
        } else {
          this.showSurvivalIcon = false;
        }
      },
      processBarchartData: function () {
        var _dataIssue = false;
        var smallerOutlier = [];
        var greaterOutlier = [];
        
        this.data.meta = _.map(_.filter(_.pluck(
          iViz.getGroupNdx(this.opts.groupid), this.opts.attrId), function(d) {
          if (iViz.util.strIsNa(d, true) || (isNaN(d) && !d.includes('>') && !d.includes('<'))) {
            d = 'NA';
          }
          return d !== 'NA';
        }), function(d) {
          var number = d;
          var smallerOutlierPattern = new RegExp('^<|(>=?)$');
          var greaterOutlierPattern = new RegExp('^>|(<=?)$');
          if (isNaN(d)) {
            if (smallerOutlierPattern.test(number)) {
              smallerOutlier.push(number.replace(/[^0-9.]/g, ''));
            } else if (greaterOutlierPattern.test(number)) {
              greaterOutlier.push(number.replace(/[^0-9.]/g, ''));
            } else {
              _dataIssue = true;
            }
          } else {
            number = parseFloat(d);
          }
          return number;
        });

        if (_dataIssue) {
          this.failedToInit = true;
        } else {
          // for scientific small number
          if (this.data.meta[Math.ceil((this.data.meta.length * (1 / 2)))] < 0.001 &&
            this.data.meta[Math.ceil((this.data.meta.length * (1 / 2)))] > 0) {
            this.data.smallDataFlag = true;
            this.data.exponents = cbio.util.getDecimalExponents(this.data.meta);
            var findExtremeExponentResult = cbio.util.findExtremes(this.data.exponents);
            this.data.minExponent = findExtremeExponentResult[0];
            this.data.maxExponent = findExtremeExponentResult[1];
          } else {
            this.data.smallDataFlag = false;
          }

          if (smallerOutlier.length > 0 && greaterOutlier.length > 0) {// data contain ">, >=,<, <="
            this.data.min = _.max(smallerOutlier);
            this.data.max = _.min(greaterOutlier);
          } else {
            var findExtremeResult = cbio.util.findExtremes(this.data.meta);
            this.data.min = findExtremeResult[0];
            this.data.max = findExtremeResult[1];

            // noGrouping is true when number of different values less than or equal to 5. 
            // In this case, the chart sets data value as ticks' value directly. 
            this.data.noGrouping = false;
            if (_.unique(this.data.meta).length <= 5 && this.data.meta.length > 0) {// for data less than 6 points
              var maxData = _.max(this.data.meta);
              var minData = _.min(this.data.meta);
              if ((maxData - minData) <= findExtremeResult[4]) {// range < iqr
                this.data.noGrouping = true;
                this.data.sortedData = findExtremeResult[3];// use sorted value as ticks directly
              }
            }
          }

          this.data.attrId = this.attributes.attr_id;
          this.data.groupType = this.attributes.group_type;
          if (((this.data.max - this.data.min) > 1000) && (this.data.min > 1)) {
            this.settings.showLogScale = true;
          }
          this.barChart = new iViz.view.component.BarChart();
          this.barChart.setDownloadDataTypes(['tsv', 'pdf', 'svg']);
          this.initChart(this.settings.showLogScale);
          this.showLoad = false;
          this.updateShowSurvivalIcon();
          this.$dispatch('data-loaded', this.attributes.group_id, this.chartDivId);
        }
      },
      mouseEnter: function() {
        this.showOperations = true;
      }, mouseLeave: function() {
        this.showOperations = false;
      }, initChart: function(logScaleChecked) {
        this.opts = _.extend(this.opts, {
          logScaleChecked: logScaleChecked
        });

        this.chartInst = this.barChart.init(this.ndx, this.data, this.opts);
        var self_ = this;
        this.chartInst.on('filtered', function(_chartInst, _filter) {
          // TODO : Right now we are manually checking for brush mouseup event.
          // This should be updated one latest dc.js is released
          // https://github.com/dc-js/dc.js/issues/627
          if (!self_.addingChart) {
            if (self_.filtersUpdated) {
              self_.filtersUpdated = false;
            } else {
              self_.chartInst.select('.brush').on('mouseup', function() {
                self_.filtersUpdated = true;
                if (typeof _filter !== 'undefined' && _filter !== null &&
                  _filter.length > 1 && self_.chartInst.hasFilter()) {
                  self_.attributes.filter = self_.barChart.rangeFilter(logScaleChecked, _filter);
                  self_.$dispatch('update-filters');
                } else if (self_.attributes.filter.length > 0) {
                  self_.attributes.filter = [];
                  self_.$dispatch('update-filters');
                }
              });
            }
          }
        });
      }
    },
    ready: function() {
      this.showLoad = true;
      this.settings.width = window.iViz.styles.vars.barchart.width;
      this.settings.height = window.iViz.styles.vars.barchart.height;

      this.opts = _.extend(this.opts, {
        groupType: this.attributes.group_type,
        attrId: this.attributes.attr_id,
        displayName: this.attributes.display_name,
        chartDivId: this.chartDivId,
        chartId: this.chartId,
        groupid: this.attributes.group_id,
        width: this.settings.width,
        height: this.settings.height
      });
      
      if (this.attributes.dataLoaded !== false) {
        this.processBarchartData();
      }
    }
  });
})(
  window.Vue,
  window.d3,
  window.dc,
  window.iViz,
  window._,
  window.$ || window.jQuery,
  window.cbio
);