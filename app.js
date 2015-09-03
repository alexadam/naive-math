var naiveApp = angular.module('naiveApp', []);

naiveApp.controller('mainCtrl', ['$scope', function($scope) {
    $scope.leftExpr = '?';
    $scope.rightExpr = '?';

    $scope.generate = function() {

        $scope.leftExpr = generateLeftExpression();

        var params = {
            targetValue: $scope.leftExpr.eval,
            errorPercent: 1,
            maxExprLength: 30,
            mutationRate: 0.2,
            minNrGenerations: 10,
            maxNrGenerations: 20,
            newGenerationNrOfChildren: 1000,
            rules: rules_pi_nr
        };

        $scope.rightExpr = Evolve(params);

    };

    $scope.absVal = function (value) {
        return Math.abs(value);
    }
}]);

naiveApp.directive("mathjaxBind", function() {
    return {
        restrict: "A",
        controller: ["$scope", "$element", "$attrs",
            function($scope, $element, $attrs) {
                $scope.$watch($attrs.mathjaxBind, function(value) {
                    var content = angular.element('<p>').html(value == undefined ? "" : value);
                    $element.html("");
                    $element.append(content);
                    // MathJax.Hub.Queue(["Reprocess", MathJax.Hub, $element[0]]);
                    // MathJax.Hub.Queue(["Typeset", MathJax.Hub, $element[0]]);
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                });
            }
        ]
    };
});
