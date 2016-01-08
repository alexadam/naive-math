var naiveApp = angular.module('naiveApp', []);

naiveApp.controller('mainCtrl', ['$scope', '$timeout', function($scope, $timeout) {
    $scope.leftExpr = '?';
    $scope.rightExpr = '?';

    $scope.leftRules = createRules([phi]);
    $scope.rightRules = createRules([pi, e]);
    $scope.inProgress = false;

    $scope.generate = function() {

        $scope.inProgress = true;

        $timeout(function() {
            $scope.leftExpr = generateLeftExpression($scope.leftRules);

            var params = {
                targetValue: $scope.leftExpr.eval,
                errorPercent: 0.1,
                maxExprLength: 30,
                mutationRate: 0.2,
                minNrGenerations: 10,
                maxNrGenerations: 20,
                newGenerationNrOfChildren: 100,
                rules: $scope.rightRules
            };

            $scope.rightExpr = Evolve(params);

            $scope.inProgress = false;
        }, 100);

    };

    $scope.absVal = function(value) {
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
                    MathJax.Hub.Queue(["Typeset", MathJax.Hub]);
                });
            }
        ]
    };
});
